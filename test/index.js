require('dotenv').config({ silent: true })

const test = require('ava')
const Contentful = require('..')
const Spike = require('spike-core')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const standard = require('reshape-standard')

test('errors without an "accessToken"', (t) => {
  t.throws(
    () => { new Contentful({ spaceId: 'xxx' }) }, // eslint-disable-line
    'ValidationError: [spike-contentful constructor] option "accessToken" is required'
  )
})

test('errors without a "spaceId"', (t) => {
  t.throws(
    () => { new Contentful({ accessToken: 'xxx' }) }, // eslint-disable-line
    'ValidationError: [spike-contentful constructor] option "spaceId" is required'
  )
})

test('errors without "addDataTo"', (t) => {
  t.throws(
    () => { new Contentful({ accessToken: 'xxx', spaceId: 'xxx' }) }, // eslint-disable-line
    'ValidationError: [spike-contentful constructor] option "addDataTo" is required'
  )
})

test('initializes with an "accessToken", "spaceId", and "addDataTo"', (t) => {
  const rt = new Contentful({ accessToken: 'xxx', spaceId: 'xxx', addDataTo: {} })
  t.truthy(rt)
})

test('initializes with "limit" filter', (t) => {
  t.truthy(new Contentful({
    accessToken: 'xxx',
    spaceId: 'xxx',
    addDataTo: {},
    contentTypes: [{
      name: 'test', id: 'xxxx', filters: { limit: 50 }
    }]
  }))
})

test('errors with "limit" filter under 1', (t) => {
  t.throws(
    () => {
      new Contentful({ accessToken: 'xxx', spaceId: 'xxx', addDataTo: {}, contentTypes: [{ // eslint-disable-line
        name: 'test', id: 'xxxx', filters: { limit: 0 } }
      ]})
    },
    /option "limit" must be larger than or equal to 1/
  )
})

test('errors with "limit" filter over 100', (t) => {
  t.throws(
    () => {
      new Contentful({ accessToken: 'xxx', spaceId: 'xxx', addDataTo: {}, contentTypes: [{ // eslint-disable-line
        name: 'test', id: 'xxxx', filters: { limit: 101 } }
      ]})
    },
    /option "limit" must be less than or equal to 1/
  )
})

test('initializes with "limit" filter', (t) => {
  const opts = {
    accessToken: 'xxx',
    spaceId: 'xxx',
    addDataTo: {},
    contentTypes: [{
      name: 'test', id: 'xxxx', filters: { limit: 50 } }
    ]
  }
  t.truthy(new Contentful(opts))
})

test.cb('returns valid content', (t) => {
  const locals = {}
  const api = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'cats',
        id: 'cat'
      }, {
        name: 'dogs',
        id: 'dog'
      }
    ]
  })

  api.run(undefined, () => {
    t.is(locals.contentful.dogs.length, 2)
    t.is(locals.contentful.cats.length, 3)
    t.end()
  })
})

test.cb('defaults id to name if not present', (t) => {
  const locals = {}
  const api = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [{ name: 'cat' }]
  })

  api.run(undefined, () => {
    t.is(locals.contentful.cat.length, 3)
    t.end()
  })
})

test.cb('implements request options', (t) => {
  const locals = {}
  const api = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'cats',
        id: 'cat',
        filters: { limit: 1 }
      }
    ]
  })

  api.run(undefined, () => {
    t.is(locals.contentful.cats.length, 1)
    t.is(locals.contentful.cats[0].fields.name, 'Garfield')
    t.end()
  })
})

test.cb('works with custom transform function', (t) => {
  const locals = {}

  const api = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'cats',
        id: 'cat',
        filters: {
          limit: 1
        },
        transform: (entry) => {
          entry.doge = 'wow'
          return entry
        }
      }
    ]
  })

  api.run(undefined, () => {
    t.is(locals.contentful.cats[0].doge, 'wow')
    t.end()
  })
})

test.cb('can implement default transform function', (t) => {
  const locals = {}
  const api = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'cats',
        id: 'cat',
        transform: true,
        filters: {
          limit: 1
        }
      }
    ]
  })

  api.run(undefined, () => {
    t.truthy(typeof locals.contentful.cats[0].name === 'string')
    t.end()
  })
})

test.cb('works as a plugin to spike', (t) => {
  const projectPath = path.join(__dirname, 'fixtures/default')
  const project = new Spike({
    root: projectPath,
    entry: { main: [path.join(projectPath, 'main.js')] }
  })

  project.on('error', t.end)
  project.on('warning', t.end)
  project.on('compile', () => {
    const src = fs.readFileSync(path.join(projectPath, 'public/index.html'), 'utf8')
    t.truthy(src.trim() === '<p>Nyan Cat</p>')
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('writes json outputs', (t) => {
  const projectPath = path.join(__dirname, 'fixtures/json')
  const project = new Spike({
    root: projectPath,
    entry: { main: [path.join(projectPath, 'main.js')] }
  })

  project.on('error', t.end)
  project.on('warning', t.end)
  project.on('compile', () => {
    const globalFile = path.join(projectPath, 'public/data.json')
    const specificFile = path.join(projectPath, 'public/dogs.json')
    t.falsy(fs.accessSync(globalFile))
    t.falsy(fs.accessSync(specificFile))
    const srcGlobal = JSON.parse(fs.readFileSync(path.join(projectPath, 'public/data.json'), 'utf8'))
    const srcSpecififc = JSON.parse(fs.readFileSync(path.join(projectPath, 'public/dogs.json'), 'utf8'))
    t.truthy(srcGlobal.dogs.length === 2)
    t.truthy(srcSpecififc.length === 2)
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('accepts template object and generates html', (t) => {
  const locals = {}
  const contentful = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'cats',
        id: 'cat',
        filters: {
          limit: 2,
          order: 'sys.createdAt'
        },
        template: {
          path: 'template.html',
          output: (item) => `cats/${item.fields.name}.html`
        }
      }
    ]
  })

  const projectPath = path.join(__dirname, 'fixtures/template')
  const project = new Spike({
    root: projectPath,
    reshape: standard({ locals }),
    entry: { main: [path.join(projectPath, 'main.js')] },
    plugins: [contentful]
  })

  project.on('error', t.end)
  project.on('compile', () => {
    const file1 = fs.readFileSync(path.join(projectPath, 'public/cats/Happy Cat.html'), 'utf8')
    const file2 = fs.readFileSync(path.join(projectPath, 'public/cats/Nyan Cat.html'), 'utf8')
    t.is(file1.trim(), '<p>Happy Cat</p>')
    t.is(file2.trim(), '<p>Nyan Cat</p>')
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('generates error if template has an error', (t) => {
  const locals = {}
  const contentful = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'cats',
        id: 'cat',
        filters: {
          limit: 1
        },
        template: {
          path: 'error.html',
          output: (item) => `cats/${item.fields.name}.html`
        }
      }
    ]
  })

  const projectPath = path.join(__dirname, 'fixtures/error')
  const project = new Spike({
    root: projectPath,
    reshape: standard({ locals }),
    entry: { main: [path.join(projectPath, 'main.js')] },
    plugins: [contentful]
  })

  project.on('warning', t.end)
  project.on('compile', () => t.end('no error'))
  project.on('error', (error) => {
    t.regex(error.toString(), /Error: Cannot read property 'fields' of undefined/)
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('generates error if template has no path', (t) => {
  const locals = {}
  const contentful = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'cats',
        id: 'cat',
        filters: {
          limit: 2,
          order: 'sys.createdAt'
        },
        template: {
          output: (item) => `cats/${item.fields.name}.html`
        }
      }
    ]
  })

  const projectPath = path.join(__dirname, 'fixtures/template')
  const project = new Spike({
    root: projectPath,
    reshape: standard({ locals }),
    entry: { main: [path.join(projectPath, 'main.js')] },
    plugins: [contentful]
  })

  project.on('error', (error) => {
    t.regex(error.toString(), /Error: cats.template must have a "path" property/)
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })
  project.compile()
})

test.cb('generates error if template has no output function', (t) => {
  const locals = {}
  const contentful = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'cats',
        id: 'cat',
        filters: {
          limit: 2,
          order: 'sys.createdAt'
        },
        template: {
          path: 'template.html'
        }
      }
    ]
  })

  const projectPath = path.join(__dirname, 'fixtures/template')
  const project = new Spike({
    root: projectPath,
    reshape: standard({ locals }),
    entry: { main: [path.join(projectPath, 'main.js')] },
    plugins: [contentful]
  })

  project.on('error', (error) => {
    t.regex(error.toString(), /Error: cats.template must have an "output" function/)
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })
  project.compile()
})

test.cb('can use locals in template', (t) => {
  const locals = {
    localTest: 'locals available'
  }
  const contentful = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'cats',
        id: 'cat',
        filters: {
          limit: 2,
          order: 'sys.createdAt'
        },
        template: {
          path: 'template.html',
          output: (item) => `cats/${item.fields.name}.html`
        }
      }
    ]
  })

  const projectPath = path.join(__dirname, 'fixtures/template-locals')
  const project = new Spike({
    root: projectPath,
    reshape: standard({ locals }),
    entry: { main: [path.join(projectPath, 'main.js')] },
    plugins: [contentful]
  })

  project.on('error', t.end)
  project.on('compile', () => {
    const file1 = fs.readFileSync(path.join(projectPath, 'public/cats/Happy Cat.html'), 'utf8')
    const file2 = fs.readFileSync(path.join(projectPath, 'public/cats/Nyan Cat.html'), 'utf8')
    t.is(file1.trim(), `<p>${locals.localTest}</p>`)
    t.is(file2.trim(), `<p>${locals.localTest}</p>`)
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('can use contentful in template', (t) => {
  const locals = {}
  const contentful = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'cats',
        id: 'cat',
        filters: {
          limit: 2,
          order: 'sys.createdAt'
        },
        template: {
          path: 'template.html',
          output: (item) => `cats/${item.fields.name}.html`
        }
      }
    ]
  })

  const projectPath = path.join(__dirname, 'fixtures/template-contentful')
  const project = new Spike({
    root: projectPath,
    reshape: standard({ locals }),
    entry: { main: [path.join(projectPath, 'main.js')] },
    plugins: [contentful]
  })

  project.on('error', t.end)
  project.on('compile', () => {
    const file1 = fs.readFileSync(path.join(projectPath, 'public/cats/Happy Cat.html'), 'utf8')
    const file2 = fs.readFileSync(path.join(projectPath, 'public/cats/Nyan Cat.html'), 'utf8')
    t.is(file1.trim(), '<p>Nyan Cat</p>')
    t.is(file2.trim(), '<p>Nyan Cat</p>')
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })

  project.compile()
})