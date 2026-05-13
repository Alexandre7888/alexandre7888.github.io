function SystemStatus() {
    const [visible, setVisible] = React.useState(true);

    if (!visible) return null;

    return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 m-4 relative shadow-sm rounded-r">
            <div className="flex">
                <div className="flex-shrink-0">
                    <div className="icon-triangle-alert text-yellow-400"></div>
                </div>
                <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                        <span className="font-bold">Aviso do Desenvolvedor:</span> As notificações Push (segundo plano) estão em desenvolvimento e podem demorar um pouco para funcionarem 100%. 
                        <br/>
                        <span className="italic text-xs mt-1 block">Motivo: Erro de servidor e orçamento limitado (salário zeradão 😅). Agradecemos a paciência!</span>
                    </p>
                </div>
            </div>
            <button 
                onClick={() => setVisible(false)}
                className="absolute top-2 right-2 text-yellow-500 hover:text-yellow-700"
            >
                <div className="icon-x text-sm"></div>
            </button>
        </div>
    );
}