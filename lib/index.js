require('when/es6-shim/Promise')

const contentful = require('contentful')
const Joi = require('joi')
const W = require('when')
const fs = require('fs')
const path = require('path')
const node = require('when/node')
const posthtml = require('posthtml')

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
        return writeTemplate(ct, compiler, compilation, this.addDataTo)
      }).done(() => done(), done)
    })
  }

  run (compiler, compilation, done) {
    return W.reduce(this.contentTypes, (m, ct) => {
      let id = ct.id
      let transformFn = ct.transform
      let options = Object.assign({
          content_type: ct.id,
          include: 10
        },
        ct.filters)

      if (transformFn === true) transformFn = transform
      if (transformFn === false) transformFn = (x) => x

      return W(this.client.getEntries(options))
        .then(response => { return W.map(response.items, transformFn) })
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
    contentTypes: Joi.array().items(
      Joi.string(), Joi.object().keys({
        id: Joi.string(),
        name: Joi.string(),
        transform: Joi.alternatives().try(Joi.boolean(), Joi.func()).default(true)
      })
    )

    // contentTypes: Joi.array().items(
    //   Joi.string(), Joi.object().keys({
    //     name: Joi.string(),
    //     transform: Joi.alternatives().try(Joi.boolean(), Joi.func()).default(true)
    //   })
    // ).default(['posts'])
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
  entry.fields.id = entry.sys.id
  entry.fields.createdAt = entry.sys.createdAt
  entry.fields.updatedAt = entry.sys.updatedAt

  delete entry.sys
  return entry.fields
}

function writeTemplate (ct, compiler, compilation, addDataTo) {
  const data = addDataTo.contentful[ct.name]
  const filePath = path.join(compiler.options.context, ct.template.path)

  return node.call(fs.readFile.bind(fs), filePath, 'utf8')
    .then((template) => {
      return data.map((item) => {
        addDataTo = Object.assign(addDataTo, { item: item })
        compiler.request = filePath
        let plugins = compiler.options.posthtml
        if (typeof plugins === 'function') plugins = plugins.call(this, compiler)
        if (typeof plugins === 'object') plugins = plugins.defaults

        return posthtml(plugins)
          .process(template)
          .then((r) => r.html)
          .then((rendered) => {
            compilation.assets[ct.template.output(item)] = {
              source: () => rendered,
              size: () => rendered.length
            }
          })
      })
    })
}

// module.exports.writeTemplate = writeTemplate
module.exports = Contentful
module.exports.transform = transform
