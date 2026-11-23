// AhdoraDeviceAdminReceiver — the device-admin receiver behind
// AHDORA's uninstall protection.
//
// On stock Android a regular app CANNOT truly prevent its own
// uninstall. What Android does allow is Device Admin: while this
// receiver is an ACTIVE device admin, the system refuses to uninstall
// the app — uninstalling first needs the admin switched off in
// Settings (Security → Device admin apps, or the system activation
// screen). The user can always switch it off there and then
// uninstall; no app can stop a deliberate uninstall, and this
// receiver does not try to.
//
// Deliberately NO policies are requested (empty <uses-policies />):
// this admin exists only to add that one real step before an
// uninstall, not to control passwords, lock the screen, or wipe
// data. The activation screen therefore shows no scary permissions,
// only the description string.
//
// The receiver is an empty subclass — DeviceAdminReceiver only needs
// to exist and be declared in the manifest (done by the
// withAhdoraAdmin config plugin). It holds no state: the JS side
// (src/lib/deviceAdmin.ts) asks DevicePolicyManager whether this
// component is active, and the Profile toggle reflects that real
// state — never a saved preference.
package com.ahdora.app.admin

import android.app.admin.DeviceAdminReceiver

class AhdoraDeviceAdminReceiver : DeviceAdminReceiver()
