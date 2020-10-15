#!/usr/bin/env node
const pull = require('pull-stream')
const client = require('tre-cli-client')
const apps = require('../lib/apps')
const printApp = require('../lib/print-app')

client( (err, ssb) => {
  if (err) return exit(err)
  pull(
    apps(ssb),
    pull.drain(printApp, err=>{
      if (err) return exit(err)
      ssb.close( ()=>{
        process.exit(0)
      })
    })
  )

  function exitl(err) {
    console.error(err.message)
    if (ssb) ssb.close( ()=>{
      process.exit(1)
    }); else process.exit(1)
  }
})
