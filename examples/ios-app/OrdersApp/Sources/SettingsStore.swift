import Foundation

// Keeps the choices the person makes in the settings screen of the orders app.
struct SettingsStore {
    private let defaults = UserDefaults.standard

    var showsDeliveredOrders: Bool {
        get { defaults.bool(forKey: "showsDeliveredOrders") }
        set { defaults.set(newValue, forKey: "showsDeliveredOrders") }
    }

    var preferredCurrency: String {
        get { defaults.string(forKey: "preferredCurrency") ?? "EUR" }
        set { defaults.set(newValue, forKey: "preferredCurrency") }
    }
}
