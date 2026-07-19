package app.gurbani.reader.local;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VoiceSearchPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
