#!/usr/bin/env node
const debug = require('debug')('tre-apps-deploy')
const pull = require('pull-stream')
const toPull = require('stream-to-pull-stream')
const multicb = require('multicb')
const htime = require('human-time')
const parseCSP = require('content-security-policy-parser')
const unquote = require('unquote')

const client = require('tre-cli-client')
const extractMeta = require('html-extract-meta')

const getRemote = require('../lib/get-remote')
const uploadBlobs = require('../lib/upload-blobs')

const argv = require('minimist')(process.argv.slice(2))

const {dryRun} = argv

client( (err, ssb, conf, keys) =>{
  if (err) return exit(err)
  const remote = getRemote(conf)
  console.error(`remote is ${remote}`)

  uploadHTMLBlob(argv, conf, keys, remote, (err, result) => {
    if (err) return exit(err)
    const {meta, blobHash} = result
    const content = Object.assign({},
      getBasicProps(meta, conf),
      {config: {tre: conf.tre}},
      {
        codeBlob: blobHash,
        scriptHash: getScriptHashFromHTTPHeader(meta.http)
      }
    )
    
    publish(ssb, keys, content, (err, kv) => {
      if (err) return exit(err)
      console.log(JSON.stringify(kv, null, 2))
      ssb.close()
    })
  })

  function exit(err) {
    if (!err) return
    console.error(err.message)
    if (ssb) ssb.close( ()=>{
      process.exit(1)
    }); else process.exit(1)
  }
})

function publish(ssb, keys, content, cb) {
  const webapps = []
  pull(
    ssb.revisions.messagesByType('webapp'),
    // TODO: we must not use an index (messagesByType) here
    // as long as that implies allowAllAuthors!
    // we pick up the wrong app if it was altered by someone except
    // the original author
    pull.drain( e =>{
      const revRoot = e.key.slice(-1)[0]
      const content = e.value.value.content
      console.error('',
        `${revRoot.substr(0,5)}:${e.value.key.substr(0,5)}`, content.name, content.repositoryBranch, content.commit, htime(new Date(e.value.value.timestamp)), 'by', e.value.value.author.substr(0, 5))
      webapps.push(e.value) // kv
    }, err => {
      if (err) return cb(err)
      let webapp
      if (webapps.length) {
        if (!argv.revRoot) {
          webapp = findWebapp(keys.id, webapps, content)
          return cb(Error(`Please specify --revRoot to pick an application to update. Suggested: --revRoot "${webapp && revisionRoot(webapp).slice(0,6)}"`))
        } else {
          webapp = webapps.find( kv=>revisionRoot(kv).startsWith(argv.revRoot))
          if (!webapp) return cb(new Error(`webapp not found: ${argv.revRoot}`))
        }
      } else { // just one existing webapp
        webapp = findWebapp(keys.id, webapps, content)
        if (!webapp) {
          console.error('First deployment of this webapp')
          if (!argv.first) {
            return cb(new Error('specify --first if you want this to happen'))
          }
        }
      }

      content.revisionBranch = webapp.key
      content.revisionRoot = revisionRoot(webapp)
      console.error('Updating existing webapp', content.revisionRoot.substr(0, 5))

      if (dryRun) {
        console.error('Would publish:')
        return cb(null, {value: content})
      }
      
      ssb.publish(content, (err, kv) => {
        if (err) return cb(err)
        console.error('Published as', kv.key)
        cb(null, kv)
      })
    })
  )
}

function findWebapp(author, kvs, content) {
  const {repository, repositoryBranch} = content
  const kv = kvs.find( ({key, value}) => {
    debug(`${key.substr(0,5)}: `)
    const {content} = value
    if (value.author !== author) {
      debug('wrong author')
      return false
    }
    if (content.repository !== repository) {
      debug('wrong repo')
      return false
    }
    if (content.repositoryBranch !== repositoryBranch) {
      debug('wrong repo branch')
      return false
    }
    return true
  })
  return kv
}

function revisionRoot(kv) {
  return kv.value.content.revisionRoot || kv.key
}

function getBasicProps(meta, conf) {
  const mtre = (meta.namespaced && meta.namespaced.tre) || {}
  const {name, description, keywords, author, generator} = meta
  return {
    type: 'webapp',
    name,
    author,
    generator,
    description,
    keywords: keywords || [],

    repositoryBranch: mtre['repository-branch'],
    repository: mtre['repository-url'],
    commit: mtre.commit,
    main: mtre.main,

    root: conf.tre.branches.root,
    branch: conf.tre.branches.webapps
  }
}

function uploadHTMLBlob(argv, conf, keys, remote, cb) {
  const done = multicb({pluck:1, spread: true})
  const source = toPull.source(process.stdin.pipe(extractMeta(done())))
  uploadBlobs([source], conf, keys, remote, done())

  done((err, meta, hashes) => {
    if (err) {
      debug(`Uploading to ${remote} failed.`)
      return cb(err)
    }
    debug(`done uploading webapp to %s, meta: %o`, remote, meta)
    cb(null, {
      blobHash: hashes[0],
      meta
    })
  })
}

function getScriptHashFromHTTPHeader(headers) {
  const header = headers["Content-Security-Policy"]
  const csp = parseCSP(header)
  const sha = (csp['script-src'] || []).find(x=>unquote(x).startsWith('sha256-'))
  if (!sha) throw new Error("No script-src policy with sha256 found!")
  return unquote(sha).replace(/^sha256-/,'')
}
