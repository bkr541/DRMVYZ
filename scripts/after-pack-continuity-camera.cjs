'use strict'

// electron-builder `afterPack` hook (runs before code signing). `mac.extendInfo` only reaches the main app's
// Info.plist, but macOS video capture runs in the helper apps, and an iPhone (Continuity Camera) is only
// offered to bundles that declare NSCameraUseContinuityCameraDeviceType. Add it to every helper too.

const { execFileSync } = require('node:child_process')
const { readdirSync } = require('node:fs')
const path = require('node:path')

const KEY = 'NSCameraUseContinuityCameraDeviceType'

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const frameworks = path.join(appPath, 'Contents', 'Frameworks')
  const bundles = readdirSync(frameworks).filter(name => /Helper.*\.app$/.test(name))
  for (const bundle of bundles) {
    const plist = path.join(frameworks, bundle, 'Contents', 'Info.plist')
    execFileSync('/usr/bin/plutil', ['-replace', KEY, '-bool', 'true', plist])
  }
  console.log(`[afterPack] ${KEY} set on ${bundles.length} helper app(s)`)
}
