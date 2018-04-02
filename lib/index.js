const contentful = require('contentful')
const Joi = require('joi')
const W = require('when')
const SpikeUtil = require('spike-util')
const bindAllClass = require('es6bindall')

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
  constructor(opts) {
    Object.assign(this, validate(opts))
    // initialize the contentful api client
    this.client = contentful.createClient({
      accessToken: this.accessToken,
      space: this.spaceId,
      host: this.preview ? 'preview.contentful.com' : ''
    })
    bindAllClass(this, ['apply', 'run'])
  }

  apply(compiler) {
    this.util = new SpikeUtil(compiler.options)
    this.util.runAll(compiler, this.run)
    let templatePairs

    // if there are single template pages, configure them here
    compiler.plugin('before-loader-process', (ctx, options) => {
      // map each template path to its config position
      if (!templatePairs) {
        templatePairs = this.contentTypes.reduce((m, model, idx) => {
          if (!model.template) return m
          if (!model.template.path) {
            throw new Error(
              `${model.name}.template must have a "path" property`
            )
          }
          if (!model.template.output) {
            throw new Error(
              `${model.name}.template must have an "output" function`
            )
          }
          m[model.template.path] = idx
          return m
        }, {})
      }

      // get the relative path of the file currently being compiled
      const p = ctx.resourcePath.replace(`${compiler.options.context}/`, '')

      // match this path to the template pairs to get the model's full config
      if (typeof templatePairs[p] === 'undefined') return options
      const conf = this.contentTypes[templatePairs[p]]
      const data = this.addDataTo.contentful[conf.name]

      // add a reshape multi option to compile each template separately
      options.multi = data.map(d => {
        return {
          locals: Object.assign({}, this.addDataTo, { item: d }),
          name: conf.template.output(d)
        }
      })
      return options
    })

    compiler.plugin('emit', (compilation, done) => {
      if (this.json) {
        writeJson(compilation, this.json, this.addDataTo.contentful)
      }

      this.contentTypes.filter(ct => ct.json).map(ct => {
        return writeJson(
          compilation,
          ct.json,
          this.addDataTo.contentful[ct.name]
        )
      })

      done()
    })
  }

  run(compilation, done) {
    // only pull data on the initial compile in watch mode
    if (this.addDataTo.contentful && !this.aggressiveRefresh) return done()

    return W.reduce(
      this.contentTypes,
      (m, ct) => {
        let transformFn = ct.transform
        let options = Object.assign(
          {
            content_type: ct.id,
            include: this.includeLevel
          },
          ct.filters
        )

        if (transformFn === false) transformFn = x => x

        return W(this.client.getEntries(options))
          .then(response => {
            return W.map(response.items, entry => transformFn(entry))
          })
          .tap(res => {
            m[ct.name] = res
          })
          .yield(m)
      },
      {}
    ).done(res => {
      this.addDataTo = Object.assign(this.addDataTo, { contentful: res })
      done()
    }, done)
  }
}

/**
 * Validate options
 * @private
 */
function validate(opts = {}) {
  const schema = Joi.object().keys({
    accessToken: Joi.string().required(),
    spaceId: Joi.string().required(),
    preview: Joi.boolean(),
    addDataTo: Joi.object().required(),
    json: Joi.string(),
    includeLevel: Joi.number().default(1),
    contentTypes: Joi.array().items(
      Joi.object().keys({
        id: Joi.string().default(Joi.ref('name')),
        name: Joi.string(),
        ordered: Joi.boolean().default(false),
        filters: Joi.object().keys({
          limit: Joi.number()
            .integer()
            .min(1)
            .max(1000)
            .default(100)
        }),
        transform: Joi.alternatives()
          .try(Joi.boolean(), Joi.func())
          .default(false),
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
  if (res.error) {
    throw new Error(res.error)
  }
  return res.value
}

function writeJson(compilation, filename, data) {
  const src = JSON.stringify(data, null, 2)
  compilation.assets[filename] = {
    source: () => src,
    size: () => src.length
  }
}

module.exports = Contentful
