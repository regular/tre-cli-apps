#!/usr/bin/env node
const pull = require('pull-stream')
const client = require('tre-cli-client')
const apps = require('../lib/apps')
const printApp = require('../lib/print-app')

client( (err, ssb) => {
  bail(err)
  pull(
    apps(ssb),
    pull.drain(printApp, err=>{
      bail(err)
      ssb.close()
    })
  )

  function bail(err) {
    if (!err) return
    if (ssb) ssb.close()
    console.error(err.message)
    process.exit(1)
  }
})
