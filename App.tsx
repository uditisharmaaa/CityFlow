import React, { useState, useEffect, useRef, useCallback } from 'react';
import CityMap from './components/CityMap';
import LogConsole from './components/LogConsole';
import VisionFeed from './components/VisionFeed';
import { SimulationEngine } from './services/simulationService';
import { LogEntry } from './types';
import { TICK_RATE_MS } from './constants';
import { Play, Siren, RotateCcw, Activity, Truck, Signal, Radio } from 'lucide-react';

const App: React.FC = () => {
  const engineRef = useRef<SimulationEngine>(new SimulationEngine());
  const [simulationState, setSimulationState] = useState(engineRef.current.state);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [scenarioStep, setScenarioStep] = useState<0 | 1 | 2 | 3>(0); 
  const autoTriggerTimeoutRef = useRef<number | null>(null);

  const addLog = (source: LogEntry['source'], message: string, level: LogEntry['level'] = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, minute:'2-digit', second:'2-digit' }),
      source,
      message,
      level
    };
    setLogs(prev => [...prev.slice(-49), newLog]);
  };

  useEffect(() => {
    let interval: number;
    if (isRunning) {
      interval = window.setInterval(() => {
        const newState = engineRef.current.tick();
        setSimulationState({ ...newState });
      }, TICK_RATE_MS);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const triggerEmergencySequence = useCallback(() => {
     if (engineRef.current.state.emergencyActive) return;
     
     // Step 1: Vision Detection (Triggered automatically)
     setScenarioStep(1);
     addLog('VISION', 'TARGET ACQUIRED: AMBULANCE (ID: 31)', 'alert');
     
     const amb = engineRef.current.injectAmbulance();
     
     // Step 2: Warning Phase
     setTimeout(() => {
         setScenarioStep(2);
         engineRef.current.highlightTrafficLights();
         addLog('TRAFFIC_AGENT', 'Computing shortest path to City Hospital...', 'warning');
         
         // Step 3: Agents Full Activation
         setTimeout(() => {
             setScenarioStep(3);
             engineRef.current.activateAgents();
             addLog('TRAFFIC_AGENT', `Green Wave Sequence Initiated.`, 'success');
             addLog('LOGISTICS_AGENT', 'Clearing path: Stopping vehicles on emergency route.', 'success');
         }, 1200); 
         
     }, 1000);
  }, []);

  const handleStart = () => {
    setIsRunning(true);
    
    // Only schedule if not already running an emergency and not already scheduled
    // We removed the dependency on logs.length to fix the restart bug
    if (scenarioStep === 0 && !autoTriggerTimeoutRef.current && !engineRef.current.state.emergencyActive) {
        addLog('SYSTEM', 'City Digital Twin initialized. Surveillance systems active.', 'info');
        
        // Randomize trigger between 5000ms and 15000ms
        const randomDelay = Math.floor(Math.random() * 10000) + 5000;
        
        addLog('SYSTEM', `Emergency Scenario Scheduler: Trigger set for T+${(randomDelay/1000).toFixed(1)}s`, 'info');

        autoTriggerTimeoutRef.current = window.setTimeout(() => {
            triggerEmergencySequence();
            autoTriggerTimeoutRef.current = null; // Clear ref after firing
        }, randomDelay);
    }
  };

  const handleReset = () => {
    engineRef.current.reset();
    setSimulationState({ ...engineRef.current.state });
    setLogs([]);
    setIsRunning(false);
    setScenarioStep(0);
    
    // Clear any pending triggers so they don't fire after reset
    if (autoTriggerTimeoutRef.current) {
        clearTimeout(autoTriggerTimeoutRef.current);
        autoTriggerTimeoutRef.current = null;
    }
    
    // Use setTimeout to allow state to clear before adding new log
    setTimeout(() => {
        addLog('SYSTEM', 'Simulation reset.', 'info');
    }, 0);
  };

  const handleManualEmergency = () => {
    addLog('SYSTEM', 'Manual Override Initiated', 'warning');
    // Clear auto trigger if manual is used
    if (autoTriggerTimeoutRef.current) {
        clearTimeout(autoTriggerTimeoutRef.current);
        autoTriggerTimeoutRef.current = null;
    }
    triggerEmergencySequence();
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-gray-100 font-sans selection:bg-green-500/30">
        
        {/* Navigation / Header */}
        <header className="border-b border-gray-800 bg-[#0f172a]/80 backdrop-blur sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shadow-lg shadow-green-900/50">
                        <Activity className="text-black w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight text-white leading-none">Project GreenCorridor</h1>
                        <span className="text-xs text-gray-500 font-mono">AUTONOMOUS TRAFFIC CONTROLLER</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-6 text-xs font-mono text-gray-500 mr-4">
                        <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
                             SIMULATION: {isRunning ? 'ONLINE' : 'OFFLINE'}
                        </div>
                        <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${scenarioStep > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                             STATUS: {scenarioStep > 0 ? 'EMERGENCY RESPONSE' : 'NORMAL OPS'}
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Controls & Vision */}
            <div className="space-y-6">
                
                {/* Control Panel */}
                <div className="bg-[#1e293b]/50 border border-gray-700/50 rounded-xl p-6 shadow-xl backdrop-blur-sm">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Radio className="w-4 h-4" /> Command Center
                    </h2>
                    
                    <div className="space-y-4">
                        {!isRunning ? (
                            <button 
                                onClick={handleStart}
                                className="w-full group relative flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-lg transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]"
                            >
                                <Play className="w-5 h-5 fill-current" />
                                INITIALIZE SIMULATION
                            </button>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={handleManualEmergency}
                                    disabled={scenarioStep > 0}
                                    className={`col-span-2 flex items-center justify-center gap-3 py-4 rounded-lg font-bold transition-all border
                                        ${scenarioStep > 0 
                                            ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed' 
                                            : 'bg-red-500/10 text-red-500 border-red-500/50 hover:bg-red-500 hover:text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                        }`}
                                >
                                    <Siren className={`w-5 h-5 ${scenarioStep === 0 ? 'animate-pulse' : ''}`} />
                                    {scenarioStep > 0 ? 'SCENARIO IN PROGRESS...' : 'MANUAL TRIGGER'}
                                </button>
                                
                                <button 
                                    onClick={() => setIsRunning(false)}
                                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-lg transition-colors border border-gray-700"
                                >
                                    PAUSE
                                </button>
                                <button 
                                    onClick={handleReset}
                                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-lg transition-colors border border-gray-700 flex items-center justify-center gap-2"
                                >
                                    <RotateCcw className="w-4 h-4" /> RESET
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Vision Feed */}
                <div className="space-y-2">
                     <div className="flex justify-between items-center px-1">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Surveillance Feed</h3>
                        <span className="text-[10px] font-mono text-gray-600">Simulated CCTV Grid</span>
                     </div>
                     <VisionFeed 
                        simulationState={simulationState} 
                        onEmergencyDetected={() => {}} // Controlled by App auto-trigger
                     />
                </div>

                {/* Agent Status Cards */}
                <div className="grid grid-cols-1 gap-3">
                    <div className={`p-4 rounded-lg border transition-all duration-500 ${scenarioStep >= 3 ? 'bg-green-900/20 border-green-500/50' : 'bg-gray-900 border-gray-800 opacity-60'}`}>
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded bg-green-500/20 ${scenarioStep >= 3 ? 'text-green-400' : 'text-gray-500'}`}>
                                <Signal className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className={`text-sm font-bold ${scenarioStep >= 3 ? 'text-green-400' : 'text-gray-400'}`}>Traffic Agent</h4>
                                <p className="text-xs text-gray-500 mt-1">Calculates route and triggers progressive Green Wave signals.</p>
                                {scenarioStep >= 3 && <div className="mt-2 text-[10px] font-mono text-green-500 bg-green-500/10 px-2 py-1 rounded w-fit">STATUS: WAVE PROPAGATING</div>}
                            </div>
                        </div>
                    </div>

                    <div className={`p-4 rounded-lg border transition-all duration-500 ${scenarioStep >= 3 ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-900 border-gray-800 opacity-60'}`}>
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded bg-blue-500/20 ${scenarioStep >= 3 ? 'text-blue-400' : 'text-gray-500'}`}>
                                <Truck className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className={`text-sm font-bold ${scenarioStep >= 3 ? 'text-blue-400' : 'text-gray-400'}`}>Logistics Agent</h4>
                                <p className="text-xs text-gray-500 mt-1">Surgically clears traffic only on the ambulance's path.</p>
                                {scenarioStep >= 3 && <div className="mt-2 text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-1 rounded w-fit">STATUS: PATH CLEARED</div>}
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Right Column: Map & Logs */}
            <div className="lg:col-span-2 space-y-6 flex flex-col h-full">
                <CityMap state={simulationState} />
                <div className="flex-1">
                    <LogConsole logs={logs} />
                </div>
            </div>

        </main>
    </div>
  );
};

export default App;