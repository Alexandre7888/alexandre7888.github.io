// No return do ChatInterface, substitua esta linha:
{user && <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[60] w-full max-w-lg pointer-events-auto"><SystemStatus /></div>}

// POR ESTA:
{user && (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[60] w-full max-w-lg pointer-events-auto">
        <div className="bg-green-500 text-white text-xs px-3 py-1 rounded-full shadow-lg">
            Conectado como {user.name}
        </div>
    </div>
)}