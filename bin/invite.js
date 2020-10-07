#!/usr/bin/env node
const debug = require('debug')('tre-cli-apps:invite')
const pull = require('pull-stream')
const {join, resolve, relative, dirname} = require('path')
const {isMsg} = require('ssb-ref')
const client = require('tre-cli-client')
const ssbClient = require('ssb-client')
const getRemote = require('../lib/get-remote')
const {stringify} = require('tre-invite-code')
const apps = require('../lib/apps')
const printApp = require('../lib/print-app')

const argv = require('minimist')(process.argv.slice(2))
const autoname = argv.name
const count = argv.count || 1

client( (err, ssb, conf, keys) =>{
  bail(err)
  const remote = getRemote(conf)
  console.error(`remote is ${remote}`)
  pickkApp( (err, app) => {
    bail(err)
    printApp(app)
    console.error(`count: ${count}`)
    console.error(`autoname: ${autoname || '[none]'}`)
    getInviteCode(conf, keys, remote, count, (err, code) => {
      bail(err)
      format(code, app)
      ssb.close()
    })
  })

  function format(code, app) {
    console.error('got invite code', code)
    const network = conf.network || conf.caps && `*${conf.caps.shs}.random`
    const invite = {
      network,
      autofollow: keys.id,
      autoinvite: code,
      autoname,
      boot: app.revRoot
    }
    if (!autoname) delete invite.autoname
    if (!argv.compact) {
      console.log(JSON.stringify(invite, null, 2))
    } else {
      console.log(stringify(invite))
    }
  }

  function bail(err) {
    if (!err) return
    console.error(err.message)
    if (ssb) ssb.close()
    process.exit(1)
  }

  function listApps() {
    pull(apps(ssb), pull.drain(printApp, err=>{
      bail(err)
    }))
  }

  function pickkApp(cb) {
    let webapp = argv.webapp

    pull(apps(ssb), pull.collect( (err, apps) =>{
      bail(err)
      if (!apps.length) {
        return cb(new Error('No wenapps found.'))
      }
      if (apps.length == 1 && !webapp) {
        return cb(null, apps[0])
      } else if (apps.length > 1 && !webapp) {
        return cb(new Error('Please specify a webapp (Example: --webapp \'%lvxL\')'))
      }
      if (webapp && !isMsg(webapp)) {
        const app = apps.find(app => {
          return app.revRoot.startsWith(webapp)
        })
        if (!app) {
          return cb(new Error(`No webapp found that starts with ${webapp}`))
        }
        cb(null, app)
      }
    }))
  }
})

function getInviteCode(conf, keys, remote, count, cb) {
  console.error('using identity:', keys.id)
  console.error('using appKey:', conf.caps.shs)
  console.error('asking for', count, 'invite(s)')
  ssbClient(keys, {
    caps: conf.caps,
    appKey: conf.appKey,
    remote,
    manifest: {invite: {create: 'async'}}
  }, (err, ssb) => {
    if (err) return cb(err)
    ssb.invite.create(count, (err, code) => {
      ssb.close()
      cb(err, code)
    })
  })
}

function revisionRoot(kv) {
  console.log('%o', kv)
  return kv.value.content.revisionRoot || kv.key
}
