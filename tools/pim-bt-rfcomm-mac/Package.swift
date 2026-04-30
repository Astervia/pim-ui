// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "pim-bt-rfcomm-mac",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "pim-bt-rfcomm-mac", targets: ["PimBtRfcommMac"]),
    ],
    targets: [
        .executableTarget(
            name: "PimBtRfcommMac",
            linkerSettings: [
                .linkedFramework("IOBluetooth"),
                .linkedFramework("Foundation"),
            ]
        ),
    ]
)
