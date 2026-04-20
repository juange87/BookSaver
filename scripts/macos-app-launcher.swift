import AppKit
import Foundation

final class AppDelegate: NSObject, NSApplicationDelegate {
  private var serverProcess: Process?
  private var openWorkItem: DispatchWorkItem?

  func applicationDidFinishLaunching(_ notification: Notification) {
    ProcessInfo.processInfo.disableAutomaticTermination("BookSaver necesita mantener activo el servidor local.")
    ProcessInfo.processInfo.disableSuddenTermination()
    NSApp.setActivationPolicy(.regular)
    configureMenu()
    startServerIfNeeded()
    scheduleBrowserOpenIfNeeded()
    NSApp.activate(ignoringOtherApps: true)
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    false
  }

  func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
    openBookSaver(nil)
    return true
  }

  func applicationWillTerminate(_ notification: Notification) {
    openWorkItem?.cancel()
    ProcessInfo.processInfo.enableAutomaticTermination("BookSaver necesita mantener activo el servidor local.")
    ProcessInfo.processInfo.enableSuddenTermination()

    guard let process = serverProcess, process.isRunning else {
      return
    }

    process.terminate()
  }

  @objc func openBookSaver(_ sender: Any?) {
    let environment = ProcessInfo.processInfo.environment
    let host = environment["HOST"] ?? "127.0.0.1"
    let port = environment["PORT"] ?? "5173"
    let url = URL(string: "http://\(host):\(port)")!
    NSWorkspace.shared.open(url)
  }

  @objc func quitBookSaver(_ sender: Any?) {
    NSApp.terminate(nil)
  }

  private func configureMenu() {
    let mainMenu = NSMenu()
    let appItem = NSMenuItem()
    let appMenu = NSMenu()

    appMenu.addItem(
      withTitle: "Abrir BookSaver",
      action: #selector(openBookSaver(_:)),
      keyEquivalent: "o"
    )
    appMenu.addItem(.separator())
    appMenu.addItem(
      withTitle: "Salir de BookSaver",
      action: #selector(quitBookSaver(_:)),
      keyEquivalent: "q"
    )
    appItem.submenu = appMenu
    mainMenu.addItem(appItem)
    NSApp.mainMenu = mainMenu
  }

  private func startServerIfNeeded() {
    guard serverProcess == nil else {
      return
    }

    let executableURL = Bundle.main.executableURL!
    let macOSDir = executableURL.deletingLastPathComponent()
    let nodeURL = macOSDir.appendingPathComponent("node")
    let appRootURL = Bundle.main.resourceURL!.appendingPathComponent("app", isDirectory: true)

    let process = Process()
    process.executableURL = nodeURL
    process.arguments = ["src/server.js"]
    process.currentDirectoryURL = appRootURL

    var environment = ProcessInfo.processInfo.environment
    environment["HOST"] = environment["HOST"] ?? "127.0.0.1"
    environment["PORT"] = environment["PORT"] ?? "5173"
    process.environment = environment

    process.terminationHandler = { _ in
      DispatchQueue.main.async {
        NSApp.terminate(nil)
      }
    }

    do {
      try process.run()
      serverProcess = process
    } catch {
      presentLaunchError(error)
    }
  }

  private func scheduleBrowserOpenIfNeeded() {
    guard ProcessInfo.processInfo.environment["BOOKSAVER_NO_BROWSER"] == nil else {
      return
    }

    let workItem = DispatchWorkItem { [weak self] in
      self?.openBookSaver(nil)
    }
    openWorkItem = workItem
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.4, execute: workItem)
  }

  private func presentLaunchError(_ error: Error) {
    let alert = NSAlert()
    alert.alertStyle = .critical
    alert.messageText = "BookSaver no ha podido arrancar"
    alert.informativeText = error.localizedDescription
    alert.runModal()
    NSApp.terminate(nil)
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
