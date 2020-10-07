const fs = require('fs')
const {join, resolve, relative, dirname} = require('path')
const pull = require('pull-stream')
const ssbClient = require('ssb-client')
const client = require('tre-cli-client')
const multicb = require('multicb')
const debug = require('debug')('tre-apps:upload-blobs')

module.exports = function upload(sources, conf, keys, remote, cb) {
  const done = multicb({pluck: 1, spread: true})

  client(done())

  ssbClient(keys, Object.assign({},
    conf, { 
      remote,
      manifest: {blobs: { add: 'sink' }}
    }
  ), done())
  
  done( (err, ssb, pub) => {
    if (err) return cb(err)
    debug('connected to local and remote sbot')

    const done = multicb({pluck: 1, spread: true})
    //addBlobs(ssb, sources, done())
    addBlobs(pub, sources, done())
    done( (err, results) =>{
      if (err) {
        cb(err)
      } else {
        cb(null, results.map( ({hash})=>hash))
      }
      ssb.close()
      pub.close()
    })
  })
}

function addBlobs(ssb, sources, cb) {
  pull(
    pull.values(sources),
    pull.asyncMap( (source, cb) => {
      let size = 0
      pull(
        source,
        pull.through(b=>size += (b.byteLength || b.length)),
        ssb.blobs.add( (err, hash)=>{
          debug(`blobs.add result: ${err && err.message}`)
          cb(err, {size, hash})
        })
      )
    }),
    /*
    pull.asyncMap( ({hash, size}, cb) =>{
      ssb.blobs.push(hash, 3, err=>{
        debug('pushing %s', hash)
        if (err) return cb(err)
        cb(null, {hash, size})
      })
    }),
    */
    pull.collect( (err, entries)=>{
      if (err) return cb(err)
      debug('added and pushed all blobs')
      cb(null, entries)
    })
  )
}
