#!/bin/bash
# ==============================================================
#  bot.sh v2.0 — Bot para Firebase Realtime Database
#  Uso: ./bot.sh [comando] [args...]
# ==============================================================

set -euo pipefail

# ---------- CONFIGURAÇÕES ----------
FIREBASE_URL="https://html-785e3-default-rtdb.firebaseio.com"
CONFIG_FILE="$HOME/.bot_config"
STATE_DIR="/tmp/bot_states"
LOG_FILE="$HOME/bot.log"
BACKUP_DIR="$HOME/bot_backups"

mkdir -p "$STATE_DIR" "$BACKUP_DIR"

# Cores
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; PURPLE='\033[0;35m'; CYAN='\033[0;36m'; NC='\033[0m'

# Variáveis de sessão
BOT_ID=""
BOT_DATA=""
OWNER_ID=""
INTERFACE_MODE="on"
COMMANDS_FILE="$HOME/.bot_commands.json"

# ---------- FUNÇÕES BÁSICAS ----------
msg() { echo -e "$1"; }
info() { msg "${BLUE}[i]${NC} $*"; log "INFO" "$*"; }
ok() { msg "${GREEN}[✓]${NC} $*"; log "OK" "$*"; }
err() { msg "${RED}[✗]${NC} $*" >&2; log "ERROR" "$*"; exit 1; }
warn() { msg "${YELLOW}[!]${NC} $*"; log "WARN" "$*"; }

log() {
    local level="$1" msg="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $msg" >> "$LOG_FILE"
}

check_deps() {
    command -v curl >/dev/null 2>&1 || err "curl não encontrado."
    command -v jq >/dev/null 2>&1 || err "jq não encontrado."
}

request() {
    local method="$1" url="$2" data="${3:-}"
    case "$method" in
        GET)    curl -s "$url" ;;
        POST)   curl -s -X POST -d "$data" "$url" ;;
        PUT)    curl -s -X PUT -d "$data" "$url" ;;
        PATCH)  curl -s -X PATCH -d "$data" "$url" ;;
        DELETE) curl -s -X DELETE "$url" ;;
    esac
}

load_config() {
    [ -f "$CONFIG_FILE" ] && source "$CONFIG_FILE" || {
        warn "Nenhuma configuração. Use autenticação primeiro."
        return 1
    }
}

save_config() {
    cat > "$CONFIG_FILE" <<EOF
BOT_ID="$BOT_ID"
BOT_DATA='$BOT_DATA'
OWNER_ID="$OWNER_ID"
INTERFACE_MODE="$INTERFACE_MODE"
EOF
    chmod 600 "$CONFIG_FILE"
}

# ---------- AUTENTICAÇÃO ----------
auth_bot() {
    local bot_id="$1"
    info "Autenticando bot: $bot_id"
    BOT_DATA=$(request GET "$FIREBASE_URL/users/${bot_id}.json")
    [ "$BOT_DATA" = "null" ] || [ -z "$BOT_DATA" ] && err "Bot não encontrado."
    BOT_ID="$bot_id"
    OWNER_ID=$(echo "$BOT_DATA" | jq -r '.ownerId // empty')
    save_config
    ok "Bot autenticado: $(echo "$BOT_DATA" | jq -r '.name')"
}

# ---------- GRUPOS ----------
get_chat_ids() {
    echo "$BOT_DATA" | jq -r '.chats // {} | keys[]' 2>/dev/null
}

get_group_name() {
    local chat_id="$1"
    request GET "$FIREBASE_URL/groups/${chat_id}.json" | jq -r '.name // "sem nome"'
}

list_groups() {
    load_config || return 1
    msg "${PURPLE}═══════════════════ GRUPOS DO BOT ═══════════════════${NC}"
    local count=1
    for chat_id in $(get_chat_ids); do
        local name=$(get_group_name "$chat_id")
        echo -e "${WHITE}$count.${NC} ${GREEN}$name${NC} ${CYAN}($chat_id)${NC}"
        count=$((count+1))
    done
    echo ""
}

# ---------- PERMISSÕES ----------
check_perm() {
    local chat_id="$1" perm="$2"
    load_config || return 1
    local roles=$(request GET "$FIREBASE_URL/groups/${chat_id}/roles.json")
    echo "$roles" | jq -e --arg bot "$BOT_ID" --arg perm "$perm" '
        .cargos_personalizados // {} |
        to_entries[] |
        select(.value.membros[]? == $bot) |
        .value.permissoes[]? |
        select(. == $perm)
    ' >/dev/null 2>&1
}

# ---------- ENVIO DE MENSAGENS ----------
send_text() {
    local chat_id="$1" text="$2"
    load_config || exit 1
    check_perm "$chat_id" "enviar_mensagem" || err "Sem permissão para enviar texto."
    
    local timestamp=$(date +%s%3N)
    local json=$(jq -n \
        --arg text "$text" \
        --arg senderId "$BOT_ID" \
        --arg senderName "$(echo "$BOT_DATA" | jq -r '.name')" \
        --argjson timestamp "$timestamp" \
        '{ type: "text", text: $text, senderId: $senderId, senderName: $senderName, timestamp: $timestamp, ephemeral: false }')
    
    local result=$(request POST "$FIREBASE_URL/groups/${chat_id}/messages.json" "$json")
    local msg_id=$(echo "$result" | jq -r '.name // empty')
    [ -n "$msg_id" ] && ok "Mensagem enviada ($msg_id)" || err "Falha ao enviar."
    # Registra estatística
    echo "messages_sent=$((${messages_sent:-0}+1))" >> "$STATE_DIR/stats"
}

send_media() {
    local chat_id="$1" type="$2" file_data="$3" file_name="${4:-}"
    local perm="enviar_${type}"
    load_config || exit 1
    check_perm "$chat_id" "$perm" || err "Sem permissão para enviar $type."
    
    local timestamp=$(date +%s%3N)
    local json=$(jq -n \
        --arg type "$type" \
        --arg fileData "$file_data" \
        --arg fileName "$file_name" \
        --arg senderId "$BOT_ID" \
        --arg senderName "$(echo "$BOT_DATA" | jq -r '.name')" \
        --argjson timestamp "$timestamp" \
        '{ type: $type, fileData: $fileData, fileName: $fileName, senderId: $senderId, senderName: $senderName, timestamp: $timestamp, ephemeral: false }')
    
    local result=$(request POST "$FIREBASE_URL/groups/${chat_id}/messages.json" "$json")
    local msg_id=$(echo "$result" | jq -r '.name // empty')
    [ -n "$msg_id" ] && ok "Mídia $type enviada ($msg_id)" || err "Falha ao enviar."
}

# ---------- MODERAÇÃO ----------
moderation_setup() {
    # Palavras proibidas (pode carregar de arquivo)
    BANNED_WORDS=("spam" "oferta" "linkmalicioso")
    FLOOD_LIMIT=5  # mensagens em 10 segundos
    declare -A flood_tracker
}

moderation_check() {
    local chat_id="$1" sender="$2" text="$3" timestamp="$4"
    # Anti-flood simples (por usuário)
    local key="${chat_id}_${sender}"
    local now=$timestamp
    local last_time=${flood_tracker[$key]:-0}
    local count=${flood_count[$key]:-0}
    if [ $((now - last_time)) -lt 10 ]; then
        count=$((count+1))
    else
        count=1
    fi
    flood_tracker[$key]=$now
    flood_count[$key]=$count
    if [ $count -ge $FLOOD_LIMIT ]; then
        # Muta o usuário (precisa de permissão)
        if check_perm "$chat_id" "mutar_membro"; then
            mute_user "$chat_id" "$sender" 60
            send_text "$chat_id" "🚫 @$sender foi mutado por 60 segundos (flood)."
        fi
        return 1
    fi

    # Palavras proibidas
    local lower_text=$(echo "$text" | tr '[:upper:]' '[:lower:]')
    for word in "${BANNED_WORDS[@]}"; do
        if [[ "$lower_text" == *"$word"* ]]; then
            if check_perm "$chat_id" "apagar_propria_mensagem"; then
                # Apaga a mensagem (deletar no Firebase)
                # Assumindo que temos a key da mensagem, mas no listen não temos facilmente.
                # Apenas envia aviso.
                send_text "$chat_id" "⚠️ Mensagem com conteúdo proibido detectada."
            fi
            return 1
        fi
    done
    return 0
}

# ---------- GERENCIAMENTO DE MEMBROS ----------
mute_user() {
    local chat_id="$1" user_id="$2" duration="${3:-60}"  # segundos
    # Salva mute no Firebase (pode criar um nó 'mutes')
    local until=$(( $(date +%s) + duration ))
    request PUT "$FIREBASE_URL/groups/${chat_id}/mutes/${user_id}.json" "{\"until\":$until}" >/dev/null
    ok "Usuário $user_id mutado por $duration segundos."
}

unmute_user() {
    local chat_id="$1" user_id="$2"
    request DELETE "$FIREBASE_URL/groups/${chat_id}/mutes/${user_id}.json" >/dev/null
    ok "Usuário $user_id desmutado."
}

ban_user() {
    local chat_id="$1" user_id="$2"
    request PUT "$FIREBASE_URL/groups/${chat_id}/bans/${user_id}.json" "{\"bannedAt\":$(date +%s)}" >/dev/null
    ok "Usuário $user_id banido do grupo $chat_id."
}

unban_user() {
    local chat_id="$1" user_id="$2"
    request DELETE "$FIREBASE_URL/groups/${chat_id}/bans/${user_id}.json" >/dev/null
    ok "Usuário $user_id desbanido."
}

# ---------- ENQUETES ----------
poll_create() {
    local chat_id="$1" question="$2"; shift 2
    local options=("$@")
    load_config || exit 1
    check_perm "$chat_id" "criar_enquete" || err "Sem permissão."
    
    local timestamp=$(date +%s%3N)
    local opt_json=$(printf '%s\n' "${options[@]}" | jq -R . | jq -s .)
    local json=$(jq -n \
        --arg question "$question" \
        --argjson options "$opt_json" \
        --arg senderId "$BOT_ID" \
        --argjson timestamp "$timestamp" \
        '{
            type: "poll",
            question: $question,
            options: $options,
            votes: {},
            senderId: $senderId,
            timestamp: $timestamp
        }')
    
    local result=$(request POST "$FIREBASE_URL/groups/${chat_id}/messages.json" "$json")
    local poll_id=$(echo "$result" | jq -r '.name // empty')
    ok "Enquete criada (ID: $poll_id)"
}

poll_vote() {
    local chat_id="$1" poll_msg_id="$2" user_id="$3" option_index="$4"
    load_config || exit 1
    check_perm "$chat_id" "votar_enquete" || err "Sem permissão para votar."
    
    # Atualiza o voto do usuário
    request PATCH "$FIREBASE_URL/groups/${chat_id}/messages/${poll_msg_id}/votes/${user_id}.json" "$option_index" >/dev/null
    ok "Voto registrado."
}

# ---------- COMANDOS PERSONALIZADOS ----------
load_commands() {
    [ -f "$COMMANDS_FILE" ] && cat "$COMMANDS_FILE" || echo "{}"
}

save_commands() {
    echo "$1" > "$COMMANDS_FILE"
}

add_command() {
    local trigger="$1" response="$2"
    local cmds=$(load_commands)
    local updated=$(echo "$cmds" | jq --arg t "$trigger" --arg r "$response" '. + {($t): $r}')
    save_commands "$updated"
    ok "Comando '$trigger' adicionado."
}

remove_command() {
    local trigger="$1"
    local cmds=$(load_commands)
    local updated=$(echo "$cmds" | jq "del(.\"$trigger\")")
    save_commands "$updated"
    ok "Comando '$trigger' removido."
}

# ---------- AGENDAMENTO ----------
schedule_message() {
    local chat_id="$1" datetime="$2" text="$3"
    # datetime no formato "YYYY-MM-DD HH:MM"
    local epoch=$(date -d "$datetime" +%s 2>/dev/null) || err "Data inválida."
    echo "$epoch|$chat_id|$text" >> "$STATE_DIR/schedule"
    ok "Mensagem agendada para $datetime."
}

process_schedule() {
    local now=$(date +%s)
    local tmpfile="$STATE_DIR/schedule.tmp"
    touch "$tmpfile"
    while IFS='|' read -r epoch chat_id text; do
        if [ "$epoch" -le "$now" ]; then
            send_text "$chat_id" "$text"
        else
            echo "$epoch|$chat_id|$text" >> "$tmpfile"
        fi
    done < "$STATE_DIR/schedule"
    mv "$tmpfile" "$STATE_DIR/schedule"
}

# ---------- BOAS-VINDAS ----------
welcome_message() {
    local chat_id="$1" new_member="$2"
    send_text "$chat_id" "👋 Bem-vindo(a), @$new_member! Espero que se divirta."
}

# ---------- ESCUTA PRINCIPAL ----------
listen_all() {
    load_config || return 1
    moderation_setup
    info "Escuta ativa em todos os grupos. Ctrl+C para sair."
    
    declare -A last_ts
    for chat_id in $(get_chat_ids); do
        local state_file="$STATE_DIR/${chat_id}.ts"
        [ -f "$state_file" ] && last_ts[$chat_id]=$(cat "$state_file") || last_ts[$chat_id]=0
    done
    
    while true; do
        process_schedule   # verifica agendamentos
        
        for chat_id in $(get_chat_ids); do
            local msgs=$(request GET "$FIREBASE_URL/groups/${chat_id}/messages.json?orderBy=\"timestamp\"&limitToLast=15")
            [ "$msgs" = "null" ] && continue
            
            echo "$msgs" | jq -c 'to_entries[] | select(.value.timestamp > '$last_ts[$chat_id]')' | while read -r entry; do
                local key=$(echo "$entry" | jq -r '.key')
                local sender=$(echo "$entry" | jq -r '.value.senderId')
                local text=$(echo "$entry" | jq -r '.value.text // empty')
                local ts=$(echo "$entry" | jq -r '.value.timestamp')
                
                # Ignora mensagens do bot
                [ "$sender" = "$BOT_ID" ] && continue
                
                echo "$ts" > "$STATE_DIR/${chat_id}.ts"
                last_ts[$chat_id]=$ts
                
                # Moderação
                moderation_check "$chat_id" "$sender" "$text" "$ts" || continue
                
                # Comandos personalizados
                local msg_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]' | xargs)
                local cmds=$(load_commands)
                local response=$(echo "$cmds" | jq -r --arg m "$msg_lower" '.[$m] // empty')
                if [ -n "$response" ]; then
                    send_text "$chat_id" "$response"
                    continue
                fi
                
                # Respostas padrão
                case "$msg_lower" in
                    "olá"|"oi"|"ola")
                        send_text "$chat_id" "Olá! Como posso ajudar?" ;;
                    "ping")
                        send_text "$chat_id" "pong 🏓" ;;
                    "/ajuda")
                        send_text "$chat_id" "Comandos: olá, ping, /ajuda, /comandos" ;;
                    "/comandos")
                        local cmd_list=$(load_commands | jq -r 'keys[]' | tr '\n' ', ')
                        send_text "$chat_id" "Comandos personalizados: ${cmd_list%, }" ;;
                esac
            done
        done
        sleep 3
    done
}

# ---------- BACKUP E RESTORE ----------
backup_config() {
    load_config || exit 1
    local backup_file="$BACKUP_DIR/bot_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$backup_file" "$CONFIG_FILE" "$COMMANDS_FILE" "$STATE_DIR/schedule" 2>/dev/null
    ok "Backup salvo em $backup_file"
}

restore_config() {
    local backup_file="$1"
    [ ! -f "$backup_file" ] && err "Arquivo de backup não encontrado."
    tar -xzf "$backup_file" -C / 2>/dev/null
    ok "Backup restaurado. Reinicie o bot."
}

# ---------- INTERFACE TUI ----------
tui_menu() {
    load_config || { auth_menu; return; }
    
    while true; do
        local opcao=$(whiptail --title "BOT FIREBASE v2.0" --menu "Escolha:" 22 76 16 \
            "1" "Listar grupos" \
            "2" "Enviar mensagem de texto" \
            "3" "Enviar imagem (URL)" \
            "4" "Enviar áudio (base64)" \
            "5" "Enviar vídeo (URL)" \
            "6" "Enviar documento (URL)" \
            "7" "Gerenciar cargos" \
            "8" "Gerenciar membros (mutar/banir)" \
            "9" "Criar enquete" \
            "10" "Adicionar comando personalizado" \
            "11" "Remover comando personalizado" \
            "12" "Agendar mensagem" \
            "13" "Iniciar escuta em todos os grupos" \
            "14" "Alternar interface (on/off)" \
            "15" "Backup da configuração" \
            "16" "Sair" 3>&1 1>&2 2>&3)
        
        [ $? -ne 0 ] && break
        
        case "$opcao" in
            1) list_groups; read -p "Enter..." ;;
            2) 
                chat_id=$(select_chat_id); [ -z "$chat_id" ] && continue
                texto=$(whiptail --inputbox "Mensagem:" 8 60 3>&1 1>&2 2>&3)
                send_text "$chat_id" "$texto"
                read -p "Enter..." ;;
            3)
                chat_id=$(select_chat_id); [ -z "$chat_id" ] && continue
                url=$(whiptail --inputbox "URL da imagem:" 8 60 3>&1 1>&2 2>&3)
                nome=$(whiptail --inputbox "Nome:" 8 60 "imagem.jpg" 3>&1 1>&2 2>&3)
                send_media "$chat_id" "image" "$url" "$nome"
                read -p "Enter..." ;;
            4)
                chat_id=$(select_chat_id); [ -z "$chat_id" ] && continue
                b64=$(whiptail --inputbox "Base64 do áudio:" 8 60 3>&1 1>&2 2>&3)
                send_media "$chat_id" "audio" "$b64" "audio.webm"
                read -p "Enter..." ;;
            5)
                chat_id=$(select_chat_id); [ -z "$chat_id" ] && continue
                url=$(whiptail --inputbox "URL do vídeo:" 8 60 3>&1 1>&2 2>&3)
                send_media "$chat_id" "video" "$url" "video.mp4"
                read -p "Enter..." ;;
            6)
                chat_id=$(select_chat_id); [ -z "$chat_id" ] && continue
                url=$(whiptail --inputbox "URL do documento:" 8 60 3>&1 1>&2 2>&3)
                nome=$(whiptail --inputbox "Nome:" 8 60 "documento.pdf" 3>&1 1>&2 2>&3)
                send_media "$chat_id" "document" "$url" "$nome"
                read -p "Enter..." ;;
            7) role_menu ;;
            8) member_menu ;;
            9)
                chat_id=$(select_chat_id); [ -z "$chat_id" ] && continue
                pergunta=$(whiptail --inputbox "Pergunta:" 8 60 3>&1 1>&2 2>&3)
                opcoes=$(whiptail --inputbox "Opções separadas por vírgula:" 8 60 "Sim,Não,Talvez" 3>&1 1>&2 2>&3)
                IFS=',' read -ra opts <<< "$opcoes"
                poll_create "$chat_id" "$pergunta" "${opts[@]}"
                read -p "Enter..." ;;
            10)
                gatilho=$(whiptail --inputbox "Comando (ex: /regras):" 8 60 3>&1 1>&2 2>&3)
                resposta=$(whiptail --inputbox "Resposta:" 8 60 3>&1 1>&2 2>&3)
                add_command "$gatilho" "$resposta"
                read -p "Enter..." ;;
            11)
                gatilho=$(whiptail --inputbox "Comando a remover:" 8 60 3>&1 1>&2 2>&3)
                remove_command "$gatilho"
                read -p "Enter..." ;;
            12)
                chat_id=$(select_chat_id); [ -z "$chat_id" ] && continue
                data=$(whiptail --inputbox "Data (YYYY-MM-DD HH:MM):" 8 60 3>&1 1>&2 2>&3)
                texto=$(whiptail --inputbox "Mensagem:" 8 60 3>&1 1>&2 2>&3)
                schedule_message "$chat_id" "$data" "$texto"
                read -p "Enter..." ;;
            13) listen_all ;;
            14)
                if [ "$INTERFACE_MODE" = "on" ]; then
                    INTERFACE_MODE="off"
                    save_config
                    whiptail --msgbox "Interface desativada." 8 40
                else
                    INTERFACE_MODE="on"
                    save_config
                    whiptail --msgbox "Interface ativada." 8 40
                fi ;;
            15) backup_config; read -p "Enter..." ;;
            16) exit 0 ;;
            *) ;;
        esac
    done
}

member_menu() {
    local chat_id=$(select_chat_id); [ -z "$chat_id" ] && return
    local acao=$(whiptail --title "Gerenciar Membros - $chat_id" --menu "Escolha:" 12 50 4 \
        "mutar" "Mutar usuário" \
        "desmutar" "Desmutar usuário" \
        "banir" "Banir usuário" \
        "desbanir" "Desbanir usuário" 3>&1 1>&2 2>&3)
    [ $? -ne 0 ] && return
    
    local user_id=$(whiptail --inputbox "ID do usuário:" 8 60 3>&1 1>&2 2>&3)
    case "$acao" in
        mutar)
            local dur=$(whiptail --inputbox "Duração (segundos):" 8 60 "60" 3>&1 1>&2 2>&3)
            mute_user "$chat_id" "$user_id" "$dur"
            ;;
        desmutar) unmute_user "$chat_id" "$user_id" ;;
        banir) ban_user "$chat_id" "$user_id" ;;
        desbanir) unban_user "$chat_id" "$user_id" ;;
    esac
    read -p "Enter..."
}

select_chat_id() {
    local chats=($(get_chat_ids))
    local menu_args=()
    for chat_id in "${chats[@]}"; do
        local name=$(get_group_name "$chat_id")
        menu_args+=("$chat_id" "$name")
    done
    whiptail --title "Selecionar grupo" --menu "Grupo:" 15 60 5 "${menu_args[@]}" 3>&1 1>&2 2>&3
}

# ---------- CLI ----------
cli_mode() {
    local cmd="$1"; shift
    case "$cmd" in
        auth) auth_bot "$@" ;;
        groups) list_groups ;;
        send) send_text "$@" ;;
        image|audio|video|document) send_media "$1" "$cmd" "$2" "$3" ;;
        role)
            local sub="$1"; shift
            case "$sub" in
                list|create|edit|addmember|delmember) role_manage "$sub" "$@" ;;
                *) err "Subcomando role inválido." ;;
            esac ;;
        mute) mute_user "$@" ;;
        unmute) unmute_user "$@" ;;
        ban) ban_user "$@" ;;
        unban) unban_user "$@" ;;
        poll) poll_create "$@" ;;
        schedule) schedule_message "$@" ;;
        cmd-add) add_command "$@" ;;
        cmd-rm) remove_command "$@" ;;
        listen) listen_all ;;
        backup) backup_config ;;
        restore) restore_config "$1" ;;
        interface) 
            INTERFACE_MODE="${1:-on}"
            save_config
            ok "Interface mode: $INTERFACE_MODE" ;;
        *) err "Comando desconhecido: $cmd" ;;
    esac
}

main() {
    check_deps
    load_config 2>/dev/null || true
    
    if [ $# -eq 0 ]; then
        if [ "$INTERFACE_MODE" = "on" ] && command -v whiptail >/dev/null 2>&1; then
            tui_menu
        else
            echo "Interface desativada ou whiptail não instalado. Use comandos."
            echo "Comandos: auth, groups, send, image, audio, video, document, role, mute, unmute, ban, unban, poll, schedule, cmd-add, cmd-rm, listen, backup, restore, interface"
            exit 1
        fi
    else
        cli_mode "$@"
    fi
}

main "$@"
