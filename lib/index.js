const contentful = require('contentful')
const Joi = require('joi')
const W = require('when')
const fs = require('fs')
const path = require('path')
const node = require('when/node')
const reshape = require('reshape')
const loader = require('reshape-loader')
const SpikeUtil = require('spike-util')

// This plugin works in almost exactly the same way as spike-records, but has
// been customized specifically for contentful. For a more thoroughly annotated
// source covering the remote fetch, template writing, etc, check out the source
// for spike-records. Many of the annotations would be exactly the same, so I'm
// trying to avoid extra repetition.
// https://github.com/static-dev/spike-records
//
// Anything that is not duplicated in the spike-records source will be clearly
// explained and annotated here!
class Contentful {
  constructor (opts) {
    Object.assign(this, validate(opts))
    // initialize the contentful api client
    this.client = contentful.createClient({
      accessToken: this.accessToken,
      space: this.spaceId
    })
  }

  apply (compiler) {
    this.util = new SpikeUtil(compiler.options)

    this.util.runAll(compiler, this.run.bind(this, compiler))

    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('normal-module-loader', (loaderContext) => {
        this.loaderContext = loaderContext
      })
    })

    compiler.plugin('emit', (compilation, done) => {
      if (this.json) {
        writeJson(compilation, this.json, this.addDataTo.contentful)
      }

      this.contentTypes.filter((ct) => ct.json).map((ct) => {
        return writeJson(compilation, ct.json, this.addDataTo.contentful[ct.name])
      })

      const templateContent = this.contentTypes.filter((ct) => {
        return ct.template
      })

      W.map(templateContent, (contentType) => {
        return writeTemplate.call(this, compiler, compilation, contentType)
      }).done(() => done(), done)
    })
  }

  run (compiler, compilation, done) {
    return W.reduce(this.contentTypes, (m, ct) => {
      let transformFn = ct.transform
      let options = Object.assign({
        content_type: ct.id,
        include: this.includeLevel
      }, ct.filters)

      if (transformFn === true) transformFn = transform
      if (transformFn === false) transformFn = (x) => x

      return W(this.client.getEntries(options))
        .then(response => {
          return W.map(response.items, (entry) => transformFn(entry))
        })
        .tap((res) => { m[ct.name] = res })
        .yield(m)
    }, {}).done((res) => {
      this.addDataTo = Object.assign(this.addDataTo, { contentful: res })
      done()
    }, done)
  }
}

/**
 * Validate options
 * @private
 */
function validate (opts = {}) {
  const schema = Joi.object().keys({
    accessToken: Joi.string().required(),
    spaceId: Joi.string().required(),
    addDataTo: Joi.object().required(),
    json: Joi.string(),
    includeLevel: Joi.number().default(1),
    contentTypes: Joi.array().items(
      Joi.object().keys({
        id: Joi.string().default(Joi.ref('name')),
        name: Joi.string(),
        ordered: Joi.boolean().default(false),
        filters: Joi.object().keys({
          limit: Joi.number().integer().min(1).max(100).default(100)
        }),
        transform: Joi.alternatives().try(Joi.boolean(), Joi.func()).default(false),
        json: Joi.string()
      })
    )
  })

  const res = Joi.validate(opts, schema, {
    allowUnknown: true,
    language: {
      messages: { wrapArrays: false },
      object: { child: '!![spike-contentful constructor] option {{reason}}' }
    }
  })
  if (res.error) { throw new Error(res.error) }
  return res.value
}

/**
 * Transform the Contentful response object to make it less messy
 * @private
 */
function transform (entry) {
  Object.assign(entry.fields, extractMeta(entry.sys))

  return recursiveTransform(entry, 'fields')
}

/**
 * Transform the Contentful response to remove the fields key and move the
 * data up one level.
 * @private
 */
function recursiveTransform (obj, key) {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(o => recursiveTransform(o))
  }

  return Object.keys(obj).reduce((prev, curr) => {
    if (curr === key) {
      prev = recursiveTransform(obj[curr])
    } else if (curr === 'sys') {
      prev = extractMeta(obj[curr])
    } else {
      prev[curr] = recursiveTransform(obj[curr])
    }

    return prev
  }, {})
}

/**
 * Extracts specified meta properties from Contentful's sys object and
 * returns a new object
 * @private
 */
function extractMeta (sys) {
  const props = ['id', 'createdAt', 'updatedAt', 'contentType']
  return props.reduce((m, p) => {
    if (sys[p]) m[p] = sys[p] // include only defined fields
    return m
  }, {})
}

function writeJson (compilation, filename, data) {
  const src = JSON.stringify(data, null, 2)
  compilation.assets[filename] = {
    source: () => src,
    size: () => src.length
  }
}

function writeTemplate (compiler, compilation, contentType) {
  const data = this.addDataTo.contentful[contentType.name]
  const filePath = path.join(compiler.options.context, contentType.template.path)

  return node.call(fs.readFile.bind(fs), filePath, 'utf8').then((template) => {
    return W.map(data, (item) => {
      const newLocals = Object.assign({}, this.addDataTo, { item })

      const options = loader.parseOptions.call(this.loaderContext, this.util.getSpikeOptions().reshape, {})

      return reshape(options)
        .process(template)
        .then((res) => {
          const html = res.output(newLocals)
          compilation.assets[contentType.template.output(item)] = {
            source: () => html,
            size: () => html.length
          }
        })
    })
  })
}

module.exports = Contentful
module.exports.transform = transform
