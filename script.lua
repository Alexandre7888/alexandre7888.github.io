-- 🏃 SCRIPT DE VELOCIDADE PARA DELTA
-- Aumenta a velocidade do jogador!

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local player = Players.LocalPlayer

-- Criar GUI de controle
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "SpeedControl"
screenGui.Parent = game:GetService("CoreGui")

local mainFrame = Instance.new("Frame")
mainFrame.Size = UDim2.new(0, 250, 0, 150)
mainFrame.Position = UDim2.new(0.5, -125, 0.5, -75)
mainFrame.BackgroundColor3 = Color3.fromRGB(30, 35, 45)
mainFrame.BorderSizePixel = 2
mainFrame.BorderColor3 = Color3.fromRGB(0, 200, 255)
mainFrame.Active = true
mainFrame.Draggable = true

-- Título
local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, 0, 0, 30)
title.BackgroundColor3 = Color3.fromRGB(0, 100, 200)
title.Text = "🏃 CONTROLE DE VELOCIDADE"
title.TextColor3 = Color3.fromRGB(255, 255, 255)
title.TextScaled = true
title.Font = Enum.Font.GothamBold

-- Label de velocidade atual
local speedLabel = Instance.new("TextLabel")
speedLabel.Size = UDim2.new(1, 0, 0, 30)
speedLabel.Position = UDim2.new(0, 0, 0, 35)
speedLabel.BackgroundTransparency = 1
speedLabel.Text = "Velocidade: 16"
speedLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
speedLabel.TextScaled = true

-- Slider de velocidade
local sliderFrame = Instance.new("Frame")
sliderFrame.Size = UDim2.new(1, -20, 0, 20)
sliderFrame.Position = UDim2.new(0, 10, 0, 70)
sliderFrame.BackgroundColor3 = Color3.fromRGB(50, 55, 70)
sliderFrame.BorderSizePixel = 0

local sliderFill = Instance.new("Frame")
sliderFill.Size = UDim2.new(0.3, 0, 1, 0)
sliderFill.BackgroundColor3 = Color3.fromRGB(0, 200, 255)
sliderFill.BorderSizePixel = 0

-- Input para velocidade personalizada
local speedInput = Instance.new("TextBox")
speedInput.Size = UDim2.new(0.6, 0, 0, 30)
speedInput.Position = UDim2.new(0.1, 0, 0, 100)
speedInput.BackgroundColor3 = Color3.fromRGB(50, 55, 70)
speedInput.PlaceholderText = "Digite a velocidade..."
speedInput.Text = ""
speedInput.TextColor3 = Color3.fromRGB(255, 255, 255)
speedInput.TextScaled = true

local setSpeedBtn = Instance.new("TextButton")
setSpeedBtn.Size = UDim2.new(0.25, 0, 0, 30)
setSpeedBtn.Position = UDim2.new(0.72, 0, 0, 100)
setSpeedBtn.BackgroundColor3 = Color3.fromRGB(0, 200, 100)
setSpeedBtn.Text = "DEFINIR"
setSpeedBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
setSpeedBtn.TextScaled = true

-- Montar
title.Parent = mainFrame
speedLabel.Parent = mainFrame
sliderFill.Parent = sliderFrame
sliderFrame.Parent = mainFrame
speedInput.Parent = mainFrame
setSpeedBtn.Parent = mainFrame
mainFrame.Parent = screenGui

-- Variável de velocidade
local currentSpeed = 16

-- Função para atualizar velocidade
function setSpeed(speed)
    local humanoid = player.Character and player.Character:FindFirstChild("Humanoid")
    if humanoid then
        currentSpeed = speed
        humanoid.WalkSpeed = speed
        speedLabel.Text = "Velocidade: " .. math.floor(speed)
        
        -- Atualizar slider
        local maxSpeed = 250
        local percent = math.clamp(speed / maxSpeed, 0, 1)
        sliderFill.Size = UDim2.new(percent, 0, 1, 0)
    end
end

-- Função para aumentar velocidade gradualmente
function increaseSpeed(amount)
    setSpeed(currentSpeed + amount)
end

-- Slider interativo
local isDragging = false

sliderFrame.MouseButton1Down:Connect(function()
    isDragging = true
end)

game:GetService("UserInputService").InputEnded:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 then
        isDragging = false
    end
end)

game:GetService("UserInputService").InputChanged:Connect(function(input)
    if isDragging and input.UserInputType == Enum.UserInputType.MouseMovement then
        local mouse = game:GetService("Players").LocalPlayer:GetMouse()
        local sliderPos = sliderFrame.AbsolutePosition.X
        local sliderSize = sliderFrame.AbsoluteSize.X
        
        local relativeX = math.clamp((mouse.X - sliderPos) / sliderSize, 0, 1)
        local speed = math.floor(relativeX * 250)
        setSpeed(speed)
    end
end)

-- Botão definir velocidade
setSpeedBtn.MouseButton1Click:Connect(function()
    local speed = tonumber(speedInput.Text)
    if speed then
        setSpeed(speed)
        speedInput.Text = ""
    else
        speedLabel.Text = "❌ Digite um número válido!"
        wait(1)
        speedLabel.Text = "Velocidade: " .. math.floor(currentSpeed)
    end
end)

-- Detectar quando o personagem muda
player.CharacterAdded:Connect(function(character)
    wait(0.5)
    setSpeed(currentSpeed)
end)

-- Hotkeys para velocidade
UserInputService.InputBegan:Connect(function(input)
    if input.KeyCode == Enum.KeyCode.LeftControl and input.UserInputType == Enum.UserInputType.Keyboard then
        increaseSpeed(10)
    elseif input.KeyCode == Enum.KeyCode.LeftShift and input.UserInputType == Enum.UserInputType.Keyboard then
        setSpeed(16) -- Reset para velocidade normal
    elseif input.KeyCode == Enum.KeyCode.R and input.UserInputType == Enum.UserInputType.Keyboard then
        setSpeed(100) -- Velocidade rápida
    end
end)

-- Resetar velocidade se sair do jogo
game:GetService("Players").LocalPlayer:GetPropertyChangedSignal("Character"):Connect(function()
    if not player.Character then
        currentSpeed = 16
    end
end)

print("🏃 SCRIPT DE VELOCIDADE CARREGADO!")
print("📋 Controles:")
print("🖱️ Arraste o slider para ajustar")
print("⌨️ Ctrl + = Aumentar velocidade")
print("⌨️ Shift = Resetar velocidade")
print("⌨️ R = Velocidade rápida (100)")