#!/usr/bin/env node
import {
  assertMainframeSourceContract,
  createMainframeSourceAudit,
  loadMainframeSourceContract,
} from './mainframe-source-contract.mjs'

try {
  const contract = assertMainframeSourceContract(loadMainframeSourceContract())
  process.stdout.write(`${JSON.stringify(createMainframeSourceAudit(contract), null, 2)}\n`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
