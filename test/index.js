require('dotenv').config({ silent: true })

const test = require('ava')
const Contentful = require('..')
const Spike = require('spike-core')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const exp = require('posthtml-exp')

const compilerMock = { options: { spike: { locals: {} } } }

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
  t.truthy(new Contentful({ accessToken: 'xxx', spaceId: 'xxx', addDataTo: {}, contentTypes: [{
    name: 'test', id: 'xxxx', filters: { limit: 50 } }
  ]}))
})

test('errors with "limit" filter under 1', (t) => {
  t.throws(
    () => {
      new Contentful({ accessToken: 'xxx', spaceId: 'xxx', addDataTo: {}, contentTypes: [{
        name: 'test', id: 'xxxx', filters: { limit: 0 } }
      ]})
    }, // eslint-disable-line
    /option "limit" must be larger than or equal to 1/
  )
})

test('errors with "limit" filter over 100', (t) => {
  t.throws(
    () => {
      new Contentful({ accessToken: 'xxx', spaceId: 'xxx', addDataTo: {}, contentTypes: [{
        name: 'test', id: 'xxxx', filters: { limit: 101 } }
      ]})
    }, // eslint-disable-line
    /option "limit" must be less than or equal to 1/
  )
})

test('initializes with "limit" filter', (t) => {
  let opts = { accessToken: 'xxx', spaceId: 'xxx', addDataTo: {}, contentTypes: [{
    name: 'test', id: 'xxxx', filters: { limit: 50 } }
  ]}
  t.truthy( new Contentful(opts))
})


test.cb('returns valid content', (t) => {
  const locals = {}
  const api = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'press',
        id: '4Em9bQeIQowM0QM8o40yOA'
      },
      {
        name: 'blogs',
        id: '633fTeiMaQwE44OsIqSimk'
      }
    ]
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.contentful.press.length, 91)
    t.is(locals.contentful.blogs.length, 100)
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
        name: 'blogs',
        id: '633fTeiMaQwE44OsIqSimk',
        filters: {
          limit: 1
        }
      }
    ]
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.contentful.blogs.length, 1)
    t.is(locals.contentful.blogs[0].title, 'High School Daydreams')
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
        name: 'blogs',
        id: '633fTeiMaQwE44OsIqSimk',
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

  api.run(compilerMock, undefined, () => {
    t.is(locals.contentful.blogs[0].doge, 'wow')
    t.end()
  })
})

test.cb('implements default transform function', (t) => {
  const locals = {}
  const api = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'blogs',
        id: '633fTeiMaQwE44OsIqSimk',
        filters: {
          limit: 1
        }
      }
    ]
  })

  api.run(compilerMock, undefined, () => {
    t.truthy(typeof locals.contentful.blogs[0].title === 'string')
    t.end()
  })
})


test.cb('can disable transform function', (t) => {
  const locals = {}
  const api = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'blogs',
        id: '633fTeiMaQwE44OsIqSimk',
        filters: {
          limit: 1
        },
        transform: false
      }
    ]
  })

  api.run(compilerMock, undefined, () => {
    t.truthy(typeof locals.contentful.blogs[0].sys === 'object')
    t.truthy(typeof locals.contentful.blogs[0].fields === 'object')
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
    t.truthy(src === 'fqhi1USjAIuogSS2AKEKu') // IDs listed in output, sans spaces
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('writes json output', (t) => {
  const projectPath = path.join(__dirname, 'fixtures/json')
  const project = new Spike({
    root: projectPath,
    entry: { main: [path.join(projectPath, 'main.js')] }
  })

  project.on('error', t.end)
  project.on('warning', t.end)
  project.on('compile', () => {
    const file = path.join(projectPath, 'public/data.json')
    t.falsy(fs.accessSync(file))
    const src = JSON.parse(fs.readFileSync(path.join(projectPath, 'public/data.json'), 'utf8'))
    t.truthy(src.blogs.length > 1)
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
        name: 'blogs',
        id: '633fTeiMaQwE44OsIqSimk',
        filters: {
          limit: 2,
          order: 'sys.createdAt'
        },
        template: {
          path: '../template/template.html',
          output: (item) => `blog_posts/${item.title}.html`
        }
      }
    ]
  })

  const projectPath = path.join(__dirname, 'fixtures/default')
  const project = new Spike({
    root: projectPath,
    posthtml: { plugins: [exp({ locals })] },
    entry: { main: [path.join(projectPath, 'main.js')] },
    plugins: [contentful]
  })

  project.on('error', t.end)
  project.on('warning', t.end)
  project.on('compile', () => {
    const file1 = fs.readFileSync(path.join(projectPath, 'public/blog_posts/Save The Elephants.html'), 'utf8')
    const file2 = fs.readFileSync(path.join(projectPath, 'public/blog_posts/Unlocking The Grid.html'), 'utf8')
    t.is(file1.trim(), '<p>Save The Elephants</p>')
    t.is(file2.trim(), "<p>Unlocking The Grid</p>")
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
        name: 'blogs',
        id: '633fTeiMaQwE44OsIqSimk',
        filters: {
          limit: 1
        },
        template: {
          path: '../template/error.html',
          output: (item) => `blog_posts/${item.title}.html`
        }
      }
    ]
  })

  const projectPath = path.join(__dirname, 'fixtures/default')
  const project = new Spike({
    root: projectPath,
    posthtml: { plugins: [exp({ locals })] },
    entry: { main: [path.join(projectPath, 'main.js')] },
    plugins: [contentful]
  })

  project.on('warning', t.end)
  project.on('error', (error) => {
    t.is(error.message.message, 'notItem is not defined')
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('generates appropriate output for ordered content types', (t) => {
  const locals = {}
  const api = new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'case_studies',
        ordered: true,
        id: '4FmWzuxZb2EcgyU44weG0Q',
        filters: {
          limit: 100
        }
      },
      {
        name: 'blogs',
        id: '633fTeiMaQwE44OsIqSimk',
        filters: {
          limit: 10
        }
      }
    ]
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.contentful.case_studies.length, 42)
    t.is(locals.contentful.blogs.length, 10)
    t.end()
  })
})
