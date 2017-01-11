const contentful = require('contentful')
const Joi = require('joi')
const W = require('when')
const fs = require('fs')
const path = require('path')
const node = require('when/node')
const reshape = require('reshape')
const loader = require('reshape-loader')

class Contentful {
  constructor (opts) {
    const validatedOptions = validate(opts)
    Object.assign(this, validatedOptions)
    this.client = contentful.createClient({
      accessToken: this.accessToken,
      space: this.spaceId
    })
  }

  apply (compiler) {
    compiler.plugin('run', this.run.bind(this, compiler))
    compiler.plugin('watch-run', this.run.bind(this, compiler))
    compiler.plugin('emit', (compilation, done) => {
      if (this.json) {
        const src = JSON.stringify(this.addDataTo.contentful, null, 2)
        compilation.assets[this.json] = {
          source: () => src,
          size: () => src.length
        }
      }

      const templateContent = this.contentTypes.filter((ct) => {
        return ct.template
      })

      W.map(templateContent, (ct) => {
        return writeTemplate(ct, compiler, compilation, this.addDataTo, done)
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
        id: Joi.string(),
        name: Joi.string(),
        ordered: Joi.boolean().default(false),
        filters: Joi.object().keys({
          limit: Joi.number().integer().min(1).max(100).default(100)
        }),
        transform: Joi.alternatives().try(Joi.boolean(), Joi.func()).default(false)
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

function writeTemplate (ct, compiler, compilation, addDataTo, cb) {
  const data = addDataTo.contentful[ct.name]
  const filePath = path.join(compiler.options.context, ct.template.path)

  return node.call(fs.readFile.bind(fs), filePath, 'utf8')
    .then((template) => {
      return data.map((item) => {
        addDataTo = Object.assign(addDataTo, { item: item })

        const mockContext = { resourcePath: filePath, addDependency: (x) => x }
        const options = loader.parseOptions.call(mockContext, compiler.options.reshape, {})

        return reshape(options)
          .process(template)
          .then(((locals, res) => {
            const html = res.output(locals)
            compilation.assets[ct.template.output(item)] = {
              source: () => html,
              size: () => html.length
            }
          }).bind(null, Object.assign({}, options.locals)))
          .catch(cb)
      })
    })
}

module.exports = Contentful
module.exports.transform = transform
