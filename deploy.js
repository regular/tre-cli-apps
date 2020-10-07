#!/usr/bin/env node
const fs = require('fs')
const {join, resolve, relative, dirname} = require('path')
const {exec} = require('child_process')
const crypto = require('crypto')

const debug = require('debug')('tre-apps-deploy')
const pull = require('pull-stream')
const file = require('pull-file')
const toPull = require('stream-to-pull-stream')

const client = require('tre-cli-client')

const multicb = require('multicb')
const readPkg = require('read-pkg-up').sync
//const Browserify = require('browserify')
const htime = require('human-time')
//const indexhtmlify = require('indexhtmlify')
//const metadataify = require('metadataify')
const compile = require('tre-compile/compile.js')
const addMeta = require('tre-compile/add-meta')

const getRemote = require('./lib/get-remote')
const uploadBlobs = require('./lib/upload-blobs')

const argv = require('minimist')(process.argv.slice(2))

const {dryRun, force, noCommitLog} = argv

if (argv._.length<1) {
  console.error('USAGE: tre-apps-deploy <index.js> [--dryRun] [--force] [--noCommitLog]')
  process.exit(1)
}

const sourceFile = resolve(argv._[0])
console.error('source:', sourceFile)
const sourcePath = dirname(sourceFile)
console.error('source path:', sourcePath)

isClean(sourcePath, (err, clean) => {
  if (err || !clean) {
    if (!force) process.exit(1)
    console.error('(--force is set, so we continue anyway')
  }

  const {packageJson, path} = readPkg({cwd: sourcePath})
  const pkg = packageJson
  if (!pkg) {
    console.error('package.json not found, search started at', sourcePath)
    process.exit(1)
  }
  console.log('package name', pkg.name)
  const rootDir = dirname(path)
  const main = relative(rootDir, sourceFile)

  console.error('rootDir:', rootDir)
  console.error('main:', main)

  const pkgLckPath = resolve(rootDir, 'package-lock.json')
  if (!fs.existsSync(pkgLckPath)) {
    console.error('No package-lock.json found')
    process.exit(1)
  }

  client( (err, ssb, conf, keys) =>{
    bail(err)
    const remote = getRemote(conf)
    console.error(`remote is ${remote}`)

    const basic = getBasicProps(pkg, main, conf)
    const done = multicb({pluck:1, spread: true})
    
    makeSourceBlob(argv, sourceFile, pkg, conf, keys, remote, done())
    uploadBlobs([file(pkgLckPath)], conf, keys, remote, done())
    gitInfo(rootDir, done())
     
    done( (err, html, hashes, git) => {
      bail(err)
      const lockBlob = hashes[0]
      const blobs = {
        codeBlob: html.blobHash,
        scriptHash: html.scriptHash,
        lockBlob
      }
      const tre = conf.tre

      const content = Object.assign({},
        basic,
        {config: {tre}},
        blobs,
        git,
        {name: `${basic.name} [${git.repositoryBranch.substr(0, 4)}]`}
      )
      
      publish(ssb, keys, rootDir, content, (err, kv) => {
        bail(err)
        console.error('Published as', kv.key)
        console.log(JSON.stringify(kv, null, 2))
        ssb.close()
      })
    })
    function bail(err) {
      if (!err) return
      console.error(err.message)
      if (ssb) ssb.close()
      process.exit(1)
    }
  })
})

function compileStream(sourceFile, opts) {
}

/*
function compile(sourceFile, opts) {
  debug('compiling ...')
  const browserify = Browserify()
  browserify.add(sourceFile)
  const bundle = browserify.bundle()
  bundle.on('error', err=>{
    console.error('borwserify.bundle failed', err.message)
    console.error(err.annotated)
    process.exit(-1)
  })
  const source = pull(
    toPull.source(bundle),
    pull.through(b => {
      opts.updateHash(b)
    }),
    toPull.transform(indexhtmlify(opts)),
    toPull.transform(metadataify(opts))
  )
  return source
}
*/

/*
function upload(conf, keys, path, cb) {
  ssbClient(keys, Object.assign({},
    conf, { manifest: {blobs: {add: 'sink'}} }
  ), (err, ssb) => {
    if (err) return cb(err)
    pull(
      file(path),
      ssb.blobs.add( (err, hash) =>{
        ssb.close()
        cb(err, hash)
      })
    )
  })
}
*/

function publish(ssb, keys, path, content, cb) {
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
      let webapp = findWebapp(keys.id, webapps, content)
      if (!argv.revRoot) {
        console.error(`Specify --revRoot. Suggested revRoot: ${webapp && revisionRoot(webapp).slice(0,6)}`)
      } else {
        webapp = webapps.find( kv=>revisionRoot(kv).startsWith(argv.revRoot))
      }
      if (!webapp) {
        console.error('First deployment of this webapp')
        if (!argv.first) {
          console.error('specify --first if you want this to happen')
          process.exit(1)
        }
      } else {
        content.revisionBranch = webapp.key
        content.revisionRoot = revisionRoot(webapp)
        console.error('Updating existing webapp', content.revisionRoot.substr(0, 5))
      }
      getLogMessages(path, webapp, content, (err, commits) => {
        if (err) return cb(err)
        if (noCommitLog) {
          commits = []
        }
        content['new-commits'] = commits || []
        if (dryRun) return cb(null, {value: content})
        
        ssb.publish(content, (err, kv) => {
          if (err) return cb(err)
          cb(null, kv)
        })
      })
    })
  )
}

function getLogMessages(cwd, webapp, content, cb) {
  if (!content.commit) return cb(null, [])
  const before = webapp && webapp.value.content.commit || ''
  const after = content.commit
  //if (!before || !after) return cb(null, [])
  if (before.includes('dirty') || after.includes('-dirty')) return cb(null, null)
  console.error(`getting git log messages ${before}..${after}`)
  exec(`git log --pretty=oneline ${before ? before+'..':''}${after}`, {cwd}, (err, logs) => {
    if (err) return cb(err)
    const lines = logs.split('\n').filter(Boolean)
    cb(null, lines)
  })
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

function isClean(cwd, cb) {
  exec('git status --porcelain', {cwd}, (err, status) => {
    if (err) {
      console.error('git status failed', err.message)
      return cb(err)
    }
    if (status.replace(/\n/g,''.length)) {
      console.error(`\nWorking directory is not clean: ${cwd}\n`)
      console.error(status)
      console.error('\nPlease commit and try again.\n')
      return cb(null, false)
    }
    cb(null, true)
  })
}

function gitInfo(cwd, cb) {
  const done = multicb({pluck: 1, spread: true})

  exec('git describe --dirty --always', {cwd}, done())
  exec('git remote get-url origin', {cwd}, done())
  exec('git symbolic-ref --short HEAD', {cwd}, done())

  done( (err, ref, url, branch) => {
    if (err) return cb(err)
    cb(null, {
      commit: ref.replace(/\n/,''),
      repository: url.replace(/\n/,''),
      repositoryBranch: branch.replace(/\n/,'')
    })
  })
}

function revisionRoot(kv) {
  return kv.value.content.revisionRoot || kv.key
}

function getBasicProps(pkg, main, conf) {
  return {
    type: 'webapp',
    name: pkg.name,
    root: conf.tre.branches.root,
    branch: conf.tre.branches.webapps,
    main,
    description: pkg.description,
    keywords: pkg.keywords || []
  }
}

function makeSourceBlob(argv, sourceFile, pkg, conf, keys, remote, cb) {
  if (argv.blob) {
    cb(null, {
      blobHash: argv.blob,
      scriptHash: argv.hash
    })
  } else {
    compile(sourceFile, (err, result) =>{
      if (err) return cb(err)
      const {sha, body} = result
      const source = addMeta(body, sha, pkg)
      //const source = pull.values([body])
      uploadBlobs([source], conf, keys, remote, (err, hashes) => {
        if (err) {
          debug(`Uploading to ${remote} failed.`)
          return cb(err)
        }
        debug(`done uploading webapp to ${remote}`)
        cb(null, {
          blobHash: hashes[0],
          scriptHash: sha
        })
      })
    })
  }
}
