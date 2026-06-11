import React, { useEffect } from 'react';
import { GodRealmStandalone } from './components/GodRealmStandalone';
import { VstgodthegodrealmPlugin } from './components/VstgodthegodrealmPlugin';
import { usePluginStore } from './services/pluginStore';
import godRealmSpec from './specs/VSTGODTheGodRealm.vst-spec.json';
import { nativeAudio } from './native/bridge';

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

  useEffect(() => {
    if (isInJuce && pluginId) {
      console.log('[App] Subscribing to parameters and requesting GET_PARAMETERS for:', pluginId);
      // 1. Listen to batch initialization updates
      const unsubBatch = nativeAudio.subscribeParametersList((params) => {
        Object.entries(params).forEach(([pId, val]) => {
          setPluginParameter(pluginId, pId, val);
        });
      });

      // 2. Listen to real-time parameter changes (automation)
      const unsubSingle = nativeAudio.subscribeParameter((pId, val) => {
        setPluginParameter(pluginId, pId, val);
      });

      // 3. Request current C++ parameters
      const msg = {
        type: 'GET_PARAMETERS',
        payload: {}
      };
      if ((window as any).__juce__) {
        (window as any).__juce__.postMessage(JSON.stringify(msg));
      } else if ((window as any).sendToJuce) {
        (window as any).sendToJuce(msg);
      }

      return () => {
        unsubBatch();
        unsubSingle();
      };
    }
  }, [isInJuce, pluginId, setPluginParameter]);

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
            nativeAudio.setParameter(pId, val);
          }
        }}
        parameterValues={godPlugin.parameterValues}
      />
    );
  }

  return <GodRealmStandalone />;
};

export default App;

