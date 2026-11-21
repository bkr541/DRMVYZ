import path from 'node:path'

/**
 * Match executable paths, not command arguments, so another app mentioning the name is untouched.
 * The legacy DRMVYZ bundle names are still matched so a shell left running from before the rename is closed.
 */
export function findDrmvyzProcesses(processList, { cacheRoot, stockElectronBinary, isRepoStockElectron = () => false, currentPid = process.pid }) {
  const cachePrefix = `${path.resolve(cacheRoot)}${path.sep}`
  return processList.split('\n').flatMap(line => {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line)
    if (!match) return []
    const pid = Number(match[1]), executable = match[2].trim()
    if (pid === currentPid) return []
    const isolated = executable.startsWith(cachePrefix)
    const packaged = /\/(?:STAGELESS|DRMVYZ)(?: Dev)?\.app\/Contents\/(?:MacOS|Frameworks)\//.test(executable)
    const stock = executable === stockElectronBinary && isRepoStockElectron(pid)
    return isolated || packaged || stock ? [{ pid, executable }] : []
  })
}
