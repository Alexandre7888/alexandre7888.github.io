-- 🏃 SCRIPT DE VELOCIDADE ULTRA - Versão Corrigida
-- Controle total com teclado e interface

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local player = Players.LocalPlayer

-- Variáveis globais
local currentSpeed = 16
local maxSpeedLimit = 250
local minSpeedLimit = 0
local isDragging = false
local guiEnabled = true

-- Criar GUI
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "SpeedUltra"
screenGui.Parent = game:GetService("CoreGui")

local mainFrame = Instance.new("Frame")
mainFrame.Size = UDim2.new(0, 320, 0, 280)
mainFrame.Position = UDim2.new(0.5, -160, 0.5, -140)
mainFrame.BackgroundColor3 = Color3.fromRGB(25, 30, 45)
mainFrame.BorderSizePixel = 2
mainFrame.BorderColor3 = Color3.fromRGB(0, 255, 200)
mainFrame.Active = true
mainFrame.Draggable = true
mainFrame.Parent = screenGui

-- Título
local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, 0, 0, 35)
title.BackgroundColor3 = Color3.fromRGB(0, 150, 100)
title.Text = "🏃 VELOCIDADE ULTRA"
title.TextColor3 = Color3.fromRGB(255, 255, 255)
title.TextScaled = true
title.Font = Enum.Font.GothamBold
title.Parent = mainFrame

-- Display de velocidade atual
local speedDisplay = Instance.new("TextLabel")
speedDisplay.Size = UDim2.new(1, 0, 0, 35)
speedDisplay.Position = UDim2.new(0, 0, 0, 40)
speedDisplay.BackgroundTransparency = 1
speedDisplay.Text = "⚡ Velocidade: 16"
speedDisplay.TextColor3 = Color3.fromRGB(0, 255, 200)
speedDisplay.TextScaled = true
speedDisplay.Font = Enum.Font.GothamBold
speedDisplay.Parent = mainFrame

-- Display do limite máximo
local limitDisplay = Instance.new("TextLabel")
limitDisplay.Size = UDim2.new(1, 0, 0, 30)
limitDisplay.Position = UDim2.new(0, 0, 0, 75)
limitDisplay.BackgroundTransparency = 1
limitDisplay.Text = "🔒 Limite Máximo: 250"
limitDisplay.TextColor3 = Color3.fromRGB(255, 200, 100)
limitDisplay.TextScaled = true
limitDisplay.Font = Enum.Font.GothamBold
limitDisplay.Parent = mainFrame

-- Slider de velocidade
local sliderFrame = Instance.new("Frame")
sliderFrame.Size = UDim2.new(1, -20, 0, 25)
sliderFrame.Position = UDim2.new(0, 10, 0, 110)
sliderFrame.BackgroundColor3 = Color3.fromRGB(50, 55, 70)
sliderFrame.BorderSizePixel = 0
sliderFrame.Parent = mainFrame

local sliderFill = Instance.new("Frame")
sliderFill.Size = UDim2.new(0.064, 0, 1, 0) -- 16/250
sliderFill.BackgroundColor3 = Color3.fromRGB(0, 255, 200)
sliderFill.BorderSizePixel = 0
sliderFill.Parent = sliderFrame

-- Inputs para limites
local limitInput = Instance.new("TextBox")
limitInput.Size = UDim2.new(0.45, 0, 0, 30)
limitInput.Position = UDim2.new(0.05, 0, 0, 145)
limitInput.BackgroundColor3 = Color3.fromRGB(50, 55, 70)
limitInput.BorderSizePixel = 0
limitInput.PlaceholderText = "Novo Limite"
limitInput.Text = ""
limitInput.TextColor3 = Color3.fromRGB(255, 255, 255)
limitInput.TextScaled = true
limitInput.Font = Enum.Font.Gotham
limitInput.Parent = mainFrame

local setLimitBtn = Instance.new("TextButton")
setLimitBtn.Size = UDim2.new(0.45, 0, 0, 30)
setLimitBtn.Position = UDim2.new(0.52, 0, 0, 145)
setLimitBtn.BackgroundColor3 = Color3.fromRGB(255, 150, 0)
setLimitBtn.Text = "DEFINIR LIMITE"
setLimitBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
setLimitBtn.TextScaled = true
setLimitBtn.Font = Enum.Font.GothamBold
setLimitBtn.BorderSizePixel = 0
setLimitBtn.Parent = mainFrame

-- Input para velocidade personalizada
local speedInput = Instance.new("TextBox")
speedInput.Size = UDim2.new(0.45, 0, 0, 30)
speedInput.Position = UDim2.new(0.05, 0, 0, 185)
speedInput.BackgroundColor3 = Color3.fromRGB(50, 55, 70)
speedInput.BorderSizePixel = 0
speedInput.PlaceholderText = "Velocidade"
speedInput.Text = ""
speedInput.TextColor3 = Color3.fromRGB(255, 255, 255)
speedInput.TextScaled = true
speedInput.Font = Enum.Font.Gotham
speedInput.Parent = mainFrame

local setSpeedBtn = Instance.new("TextButton")
setSpeedBtn.Size = UDim2.new(0.45, 0, 0, 30)
setSpeedBtn.Position = UDim2.new(0.52, 0, 0, 185)
setSpeedBtn.BackgroundColor3 = Color3.fromRGB(0, 200, 100)
setSpeedBtn.Text = "DEFINIR VELOC."
setSpeedBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
setSpeedBtn.TextScaled = true
setSpeedBtn.Font = Enum.Font.GothamBold
setSpeedBtn.BorderSizePixel = 0
setSpeedBtn.Parent = mainFrame

-- Botão toggle GUI
local toggleBtn = Instance.new("TextButton")
toggleBtn.Size = UDim2.new(0.45, 0, 0, 30)
toggleBtn.Position = UDim2.new(0.05, 0, 0, 225)
toggleBtn.BackgroundColor3 = Color3.fromRGB(100, 100, 200)
toggleBtn.Text = "OCULTAR GUI"
toggleBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
toggleBtn.TextScaled = true
toggleBtn.Font = Enum.Font.GothamBold
toggleBtn.BorderSizePixel = 0
toggleBtn.Parent = mainFrame

-- Botão fechar (X)
local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 30, 0, 30)
closeBtn.Position = UDim2.new(1, -35, 0, 2)
closeBtn.BackgroundColor3 = Color3.fromRGB(255, 50, 50)
closeBtn.Text = "✕"
closeBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
closeBtn.TextScaled = true
closeBtn.Font = Enum.Font.GothamBold
closeBtn.BorderSizePixel = 0
closeBtn.Parent = mainFrame

-- Função para aplicar velocidade
local function applySpeed(speed)
    local character = player.Character
    if not character then return end
    
    local humanoid = character:FindFirstChild("Humanoid")
    if humanoid then
        -- Garantir que a velocidade está dentro do limite
        local clampedSpeed = math.clamp(speed, minSpeedLimit, maxSpeedLimit)
        currentSpeed = clampedSpeed
        humanoid.WalkSpeed = clampedSpeed
        
        -- Atualizar interface
        speedDisplay.Text = "⚡ Velocidade: " .. math.floor(clampedSpeed)
        local percent = math.clamp(clampedSpeed / maxSpeedLimit, 0, 1)
        sliderFill.Size = UDim2.new(percent, 0, 1, 0)
    end
end

-- Função para definir novo limite
local function setNewLimit(newLimit)
    if type(newLimit) == "number" and newLimit > 0 then
        maxSpeedLimit = math.floor(newLimit)
        limitDisplay.Text = "🔒 Limite Máximo: " .. maxSpeedLimit
        
        -- Ajustar velocidade atual se estiver acima do novo limite
        if currentSpeed > maxSpeedLimit then
            applySpeed(maxSpeedLimit)
        else
            applySpeed(currentSpeed)
        end
        return true
    end
    return false
end

-- Slider interativo - CORRIGIDO
sliderFrame.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 then
        isDragging = true
        -- Calcular posição inicial
        local mouse = player:GetMouse()
        local sliderPos = sliderFrame.AbsolutePosition.X
        local sliderSize = sliderFrame.AbsoluteSize.X
        local relativeX = math.clamp((mouse.X - sliderPos) / sliderSize, 0, 1)
        local speed = math.floor(relativeX * maxSpeedLimit)
        applySpeed(speed)
    end
end)

sliderFrame.InputEnded:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 then
        isDragging = false
    end
end)

-- Detectar movimento do mouse globalmente
RunService.RenderStepped:Connect(function()
    if isDragging then
        local mouse = player:GetMouse()
        local sliderPos = sliderFrame.AbsolutePosition.X
        local sliderSize = sliderFrame.AbsoluteSize.X
        
        if sliderSize > 0 then
            local relativeX = math.clamp((mouse.X - sliderPos) / sliderSize, 0, 1)
            local speed = math.floor(relativeX * maxSpeedLimit)
            applySpeed(speed)
        end
    end
end)

-- Botão definir limite
setLimitBtn.MouseButton1Click:Connect(function()
    local value = tonumber(limitInput.Text)
    if value and value > 0 then
        setNewLimit(value)
        limitInput.Text = ""
        speedDisplay.Text = "✅ Limite atualizado!"
        task.wait(0.8)
        speedDisplay.Text = "⚡ Velocidade: " .. math.floor(currentSpeed)
    else
        speedDisplay.Text = "❌ Digite um número válido!"
        task.wait(1)
        speedDisplay.Text = "⚡ Velocidade: " .. math.floor(currentSpeed)
    end
end)

-- Botão definir velocidade
setSpeedBtn.MouseButton1Click:Connect(function()
    local value = tonumber(speedInput.Text)
    if value then
        applySpeed(value)
        speedInput.Text = ""
        speedDisplay.Text = "✅ Velocidade definida!"
        task.wait(0.8)
        speedDisplay.Text = "⚡ Velocidade: " .. math.floor(currentSpeed)
    else
        speedDisplay.Text = "❌ Digite um número válido!"
        task.wait(1)
        speedDisplay.Text = "⚡ Velocidade: " .. math.floor(currentSpeed)
    end
end)

-- Botão toggle GUI
toggleBtn.MouseButton1Click:Connect(function()
    guiEnabled = not guiEnabled
    mainFrame.Visible = guiEnabled
    if guiEnabled then
        toggleBtn.Text = "OCULTAR GUI"
    else
        toggleBtn.Text = "MOSTRAR GUI"
    end
end)

-- Botão fechar
closeBtn.MouseButton1Click:Connect(function()
    screenGui:Destroy()
end)

-- Hotkeys para controle de velocidade e limite
UserInputService.InputBegan:Connect(function(input)
    if input.KeyCode == Enum.KeyCode.LeftControl then
        -- Aumentar velocidade em 10
        applySpeed(currentSpeed + 10)
        
    elseif input.KeyCode == Enum.KeyCode.LeftShift then
        -- Resetar para velocidade padrão
        applySpeed(16)
        
    elseif input.KeyCode == Enum.KeyCode.R then
        -- Velocidade rápida
        applySpeed(100)
        
    elseif input.KeyCode == Enum.KeyCode.RightControl then
        -- Aumentar limite máximo
        setNewLimit(maxSpeedLimit + 50)
        speedDisplay.Text = "⬆️ Limite +50"
        task.wait(0.5)
        speedDisplay.Text = "⚡ Velocidade: " .. math.floor(currentSpeed)
        
    elseif input.KeyCode == Enum.KeyCode.RightShift then
        -- Diminuir limite máximo (mínimo 50)
        if maxSpeedLimit > 50 then
            setNewLimit(maxSpeedLimit - 50)
            speedDisplay.Text = "⬇️ Limite -50"
            task.wait(0.5)
            speedDisplay.Text = "⚡ Velocidade: " .. math.floor(currentSpeed)
        end
        
    elseif input.KeyCode == Enum.KeyCode.T then
        -- Limite máximo extremo (500)
        setNewLimit(500)
        speedDisplay.Text = "🚀 Limite 500!"
        task.wait(0.5)
        speedDisplay.Text = "⚡ Velocidade: " .. math.floor(currentSpeed)
        
    elseif input.KeyCode == Enum.KeyCode.G then
        -- Limite baixo (50)
        setNewLimit(50)
        speedDisplay.Text = "🐢 Limite 50"
        task.wait(0.5)
        speedDisplay.Text = "⚡ Velocidade: " .. math.floor(currentSpeed)
    end
end)

-- Resetar ao morrer
player.CharacterAdded:Connect(function(character)
    task.wait(0.5)
    applySpeed(currentSpeed)
end)

-- Aplicar velocidade quando o personagem carregar
if player.Character then
    task.wait(0.5)
    applySpeed(currentSpeed)
end

print("🏃 SCRIPT DE VELOCIDADE ULTRA CARREGADO!")
print("📋 CONTROLES COMPLETOS:")
print("🖱️ Slider = Ajuste suave de velocidade")
print("⌨️ Ctrl    = +10 de velocidade")
print("⌨️ Shift   = Resetar para 16")
print("⌨️ R       = Velocidade 100")
print("⌨️ CtrlDir = +50 no limite máximo")
print("⌨️ ShiftDir = -50 no limite máximo")
print("⌨️ T       = Limite 500 (extremo)")
print("⌨️ G       = Limite 50 (lento)")