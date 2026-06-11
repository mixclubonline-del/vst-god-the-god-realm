import React, { useEffect } from 'react';
import { GodRealmStandalone } from './components/GodRealmStandalone';
import { VstgodthegodrealmPlugin } from './components/VstgodthegodrealmPlugin';
import { usePluginStore } from './services/pluginStore';
import godRealmSpec from './specs/VSTGODTheGodRealm.vst-spec.json';

/**
 * VST GOD — The God Realm
 * Sovereign standalone application.
 * Routes directly to the plugin UI when running inside JUCE.
 */
const App: React.FC = () => {
  const isInJuce = typeof window !== 'undefined' && 
                   (!!(window as any).__juce__ || !!(window as any).sendToJuce);

  const { activePlugins, addPlugin, setPluginParameter } = usePluginStore();
  const godPlugin = activePlugins.find(p => p.spec.plugin.name.includes('God Realm'));
  const pluginId = godPlugin?.id;

  useEffect(() => {
    if (isInJuce && !godPlugin) {
      console.log('[App] Initializing God Realm Spec inside JUCE...');
      addPlugin(godRealmSpec as any);
    }
  }, [isInJuce, godPlugin, addPlugin]);

  if (isInJuce) {
    if (!godPlugin) {
      return (
        <div style={{
          display: 'flex',
          width: '100vw',
          height: '100vh',
          backgroundColor: '#050507',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffd700',
          fontFamily: 'sans-serif',
          fontSize: '12px',
          letterSpacing: '0.1em'
        }}>
          AWAKENING THE REALM...
        </div>
      );
    }

    return (
      <VstgodthegodrealmPlugin 
        isOpen={true} 
        onClose={() => {}} 
        embedded={true}
        width="100vw"
        height="100vh"
        onParameterChange={(pId, val) => {
          if (pluginId) {
            setPluginParameter(pluginId, pId, val);
          }
        }}
        parameterValues={godPlugin.parameterValues}
      />
    );
  }

  return <GodRealmStandalone />;
};

export default App;

