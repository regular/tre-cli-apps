#!/usr/bin/env node
const pull = require('pull-stream')
const client = require('tre-cli-client')
const htime = require('human-time')
const apps = require('../lib/apps')

client( (err, ssb) => {
  bail(err)
  pull(
    apps(ssb),
    pull.drain(app=>{
      const {revision, revRoot} = app
      const {name, author, timestamp} = app
      const {branch, commit} = app.git
      console.error([
      `${revRoot}:${revision}`,
      `"${name}" by ${author}, deployed ${htime(new Date(timestamp))}`,
      `git branch: ${branch}, commit: ${commit}`,
      ''
      ].join('\n'))
      
    }, err=>{
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
