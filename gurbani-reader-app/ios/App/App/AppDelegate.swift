import UIKit
import Capacitor
import Speech
import AVFoundation

@objc(VoiceSearchPlugin)
class VoiceSearchPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "VoiceSearchPlugin"
    let jsName = "VoiceSearch"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listen", returnType: CAPPluginReturnPromise)
    ]

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var activeCall: CAPPluginCall?
    private var transcripts: [String] = []
    private var hasInputTap = false
    private var settleWork: DispatchWorkItem?
    private var timeoutWork: DispatchWorkItem?

    @objc func available(_ call: CAPPluginCall) {
        let speechAllowed = SFSpeechRecognizer.authorizationStatus() != .denied
            && SFSpeechRecognizer.authorizationStatus() != .restricted
        let microphoneAllowed = AVAudioSession.sharedInstance().recordPermission != .denied
        let recognizerExists = SFSpeechRecognizer(locale: Locale(identifier: "pa-IN")) != nil
            || SFSpeechRecognizer(locale: Locale(identifier: "en-GB")) != nil
        call.resolve(["available": speechAllowed && microphoneAllowed && recognizerExists])
    }

    @objc func listen(_ call: CAPPluginCall) {
        guard activeCall == nil else {
            call.reject("Voice search is already listening.")
            return
        }
        requestSpeechPermission { [weak self] speechGranted in
            guard let self else { return }
            guard speechGranted else {
                call.reject("Speech recognition permission is required for voice search.")
                return
            }
            self.requestMicrophonePermission { microphoneGranted in
                DispatchQueue.main.async {
                    guard microphoneGranted else {
                        call.reject("Microphone permission is required for voice search.")
                        return
                    }
                    self.startListening(call)
                }
            }
        }
    }

    private func requestSpeechPermission(_ completion: @escaping (Bool) -> Void) {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized:
            completion(true)
        case .notDetermined:
            SFSpeechRecognizer.requestAuthorization { status in
                completion(status == .authorized)
            }
        default:
            completion(false)
        }
    }

    private func requestMicrophonePermission(_ completion: @escaping (Bool) -> Void) {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted:
            completion(true)
        case .undetermined:
            AVAudioSession.sharedInstance().requestRecordPermission(completion)
        default:
            completion(false)
        }
    }

    private func startListening(_ call: CAPPluginCall) {
        let language = call.getString("language") ?? "pa-IN"
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language)) else {
            call.reject("Speech recognition is not available for \(language) on this device.")
            return
        }
        guard recognizer.isAvailable else {
            call.reject("Speech recognition is temporarily unavailable. Check your connection and try again.")
            return
        }

        stopAudioSession()
        activeCall = call
        transcripts = []

        do {
            let session = AVAudioSession.sharedInstance()
            // Mixing allows a recording or keertan playing in another app to continue
            // while this foreground search samples the microphone.
            try session.setCategory(.playAndRecord, mode: .default, options: [.mixWithOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            recognitionRequest = request

            let inputNode = audioEngine.inputNode
            if hasInputTap { inputNode.removeTap(onBus: 0) }
            let format = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                request.append(buffer)
            }
            hasInputTap = true
            audioEngine.prepare()
            try audioEngine.start()

            recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self, self.activeCall != nil else { return }
                    if let result {
                        self.transcripts = self.uniqueTranscripts(result.transcriptions.map(\.formattedString))
                        self.scheduleSettle()
                        if result.isFinal { self.finishListening() }
                    } else if let error {
                        self.finishListening(error: error.localizedDescription)
                    }
                }
            }

            let timeout = DispatchWorkItem { [weak self] in self?.finishListening() }
            timeoutWork = timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: timeout)
        } catch {
            finishListening(error: "Voice search could not start: \(error.localizedDescription)")
        }
    }

    private func scheduleSettle() {
        settleWork?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.finishListening() }
        settleWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6, execute: work)
    }

    private func uniqueTranscripts(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.filter { value in
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return !trimmed.isEmpty && seen.insert(trimmed.folding(options: [.caseInsensitive], locale: .current)).inserted
        }.prefix(5).map { $0 }
    }

    private func finishListening(error: String? = nil) {
        guard let call = activeCall else { return }
        let matches = transcripts
        stopAudioSession()
        if !matches.isEmpty {
            call.resolve(["matches": matches])
        } else {
            call.reject(error ?? "Speech could not be recognised. Try speaking closer to the phone.")
        }
    }

    private func stopAudioSession() {
        settleWork?.cancel()
        timeoutWork?.cancel()
        settleWork = nil
        timeoutWork = nil
        if audioEngine.isRunning { audioEngine.stop() }
        if hasInputTap {
            audioEngine.inputNode.removeTap(onBus: 0)
            hasInputTap = false
        }
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
        activeCall = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

@objc(GurbaniBridgeViewController)
class GurbaniBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginType(VoiceSearchPlugin.self)
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
