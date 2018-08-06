# Spike Contentful Plugin

[![npm](http://img.shields.io/npm/v/spike-contentful.svg?style=flat-square)](https://badge.fury.io/js/spike-contentful) [![tests](http://img.shields.io/travis/static-dev/spike-contentful/master.svg?style=flat-square)](https://travis-ci.org/static-dev/spike-contentful) [![dependencies](http://img.shields.io/david/static-dev/spike-contentful.svg?style=flat-square)](https://david-dm.org/static-dev/spike-contentful)
[![coverage](http://img.shields.io/coveralls/static-dev/spike-contentful.svg?style=flat-square)](https://coveralls.io/github/static-dev/spike-contentful)

[Contentful CMS](https://www.contentful.com/) plugin for [spike](https://github.com/static-dev/spike)

> **Note:** This project is in early development, and versioning is a little different. [Read this](http://markup.im/#q4_cRZ1Q) for more details.

### Why should you care?

If you're using [Contentful](https://www.contentful.com/) and would like to pull your data for compilation into a [spike](https://github.com/static-dev/spike) static site, this will help you out.

### Installation

`npm install spike-contentful -S`

### Usage

This is a standard [webpack](https://webpack.github.io/) plugin, but is built for and intended to be used with [spike](https://github.com/static-dev/spike). You can include it in your spike project as such:

```js
// app.js
const Contentful = require('spike-contentful')
const htmlStandards = require('reshape-standard')
const locals = {}

module.exports = {
  plugins: [
    new Contentful({
      addDataTo: locals,
      accessToken: 'xxx',
      spaceId: 'xxx',
      contentTypes: [
        {
          name: 'posts',
          id: '633fTeiMaxxxxxxxxx'
        },
        {
          name: 'authors',
          id: '223gTahLaxxxxxxxxx'
        }
      ]
    })
  ],
  reshape: htmlStandards({ locals: () => locals })
}
```

At a minimum, the `spike-contentful` plugin requires both `name` and `id` for `contentTypes`. The `name` corresponds with how you'd like to access it in your templates. The `id` is found listed under "Identifier" by logging into Contentful and clicking "APIs" then "Content model explorer".

Since Spike uses `reshape`, you can use a variety of different plugins to expose local variables to your html. We are using [reshape](https://github.com/reshape/reshape) along with [spike html standards](https://github.com/static-dev/spike-html-standards) here because it's the plugin provided in spike's default template, and also is currently the only plugin that provides the ability to run complex loops through objects.

In order to pass the data correctly, you must pass `spike-contentful` an object, which it will load the data onto when the compile begins under a `contentful` key. If you also pass the same object to whatever `reshape` plugin you are using in whatever manner it requires to make the data available in your html templates, the data will be present on that object before they start compiling. This is a slightly unconventional pattern for Javascript libraries, but in this situation it allows for maximum flexibility and convenience.

Once included, it will expose a `contentful` local to your markup (`.sgr`, `.html`, etc...) files, which you can use to iterate through your content types. Based on the example above, the `posts` content type will be accessible through `contentful.posts`, as such:

```jade
// a template file
ul
  each(loop='post of contentful.posts')
    li {{ JSON.stringify(post) }}
```

For the sugar-free

```html
<ul>
	<each loop="post of contentful.blog">
		<li>{{ JSON.stringify(post) }}</li>
	</each>
</ul>
```

### Filters

#### Limit

To limit the number of results for a given content type:

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx',
  contentTypes: [
    {
      name: 'posts',
      id: '633fTeiMaxxxxxxxxx',
      filters: {
        limit: 10
      }
    }
  ]
})
```

#### Order

To order results of a given content type:

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx',
  contentTypes: [
    {
      name: 'posts',
      id: '633fTeiMaxxxxxxxxx',
      filters: {
        limit: 10,
        order: 'sys.createdAt'
      }
    }
  ]
})
```

### Returning Linked Content Entries

Contentful allows you to link content types with a field called references. This can create a chain of links. For example __Content Entry A__ could contain a reference to __Content Entry B__, and __Content Entry B__ could further reference __Content Entry C__. 

Contentful's default settings return only the first level of links, meaning that returning __Content Entry A__ from above will also retun __Content Entry B__, but not __Content Entry C__. Spike has an option called includeLevel that can be included in your Contentful object, which will allow you to return more levels of links than the default 1. This is extremely helpful if your content model relies heavily on references.

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx',
  includeLevel: 10,
  contentTypes: [
    {
      name: 'posts',
      id: '633fTeiMaxxxxxxxxx',
      filters: {
        limit: 10,
        order: 'sys.createdAt'
      }
    }
  ]
})
```

### Transforms

Contentful returns a lot of associated data and, as a result, we give you the ability to pass your own custom `transform` option to each content type allowing you to transform the data however you like before it's sent to your views.

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx',
  contentTypes: [
    {
      name: 'posts',
      id: '633fTeiMaxxxxxxxxx',
      transform: post => {
        // do your transformation here...
        return post
      }
    }
  ]
})
```

### Templates

Using the template option allows you to write objects returned from Contentful to single page templates. For example, if you are trying to render a blog as static, you might want each post returned from the API to be rendered as a single page by itself.

The `template` option is an object with `path` and `output` keys. The `path` is an absolute or relative path to a template to be used to render each item, and output is a function with the currently iterated item as a parameter, which should return a string representing a path relative to the project root where the single view should be rendered. For example:

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx',
  contentTypes: [
    {
      name: 'posts',
      id: '633fTeiMaxxxxxxxxx',
      template: {
        path: 'templates/post.html',
        output: post => {
          return `posts/${post.id}.html`
        }
      }
    }
  ]
})
```

Your template must use the `item` variable as seen below. Also note that this feature will not work if your template is ignored by spike.

```html
<p>{{item.title}}</p>
```

### Preview Environment

Using [Spike Environments](https://spike.readme.io/docs/environments), you can change your default `app.js` to use [Contentful's preview API](https://www.contentful.com/developers/docs/references/content-preview-api/) by using your project's preview key (in this example, `yyy`).

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'yyy',
  preview: true;
  spaceId: 'xxx'
})
```

Then set your `app.production.js` to:

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  preview: false;
  spaceId: 'xxx'
})
```
From there, running `spike compile` will use the preview API, and `spike compile -e production` will use the regular content delivery API.

This can also be accomplished with a single `app.js` with the help of [Dotenv](https://www.npmjs.com/package/dotenv).

Require Dotenv in your `app.js` file, then modify the Contentful call to use your preview key (in this example, `yyy`).

```js
const env = process.env.SPIKE_ENV;

new Contentful({
  addDataTo: locals,
  accessToken: env !== 'production' ? 'yyy' : 'xxx' ,
  preview: env !== 'production';
  spaceId: 'xxx'
})
```

### JSON Output

Finally, if you'd like to have the output written locally to a JSON file so that it's cached locally, you can pass the name of the file, resolved relative to your project's output, as a `json` option to the plugin. For example:

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx',
  contentTypes: [
    {
      name: 'posts',
      id: '633fTeiMaxxxxxxxxx'
    }
  ],
  json: 'data.json'
})
```

You may also choose to have the ouput written specifically for any content type :

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx',
  contentTypes: [
    {
      name: 'posts',
      id: '633fTeiMaxxxxxxxxx',
      // JSON output expected for this content type
      json: 'posts.json'
    },
    {
      name: 'press',
      id: '4Em9bQeIQxxxxxxxxx'
      // No JSON output needed for this content type
    }
  ],
  // Save all content types data in one file
  json: 'alldata.json'
})
```

### Aggressive Refresh

By default, this plugin will only fetch data once when you start your watcher, for development speed purposes. This means that if you change your data, you will have to restart the watcher to pick up the changes. If you are in a phase where you are making frequent data changes and would like a more aggressive updating strategy, you can set the `aggressiveRefresh` option to `true`, and your dreams will come true. However, note that this will slow down your local development, as it will fetch and link all entires every time you save a file, so it's only recommended for temporary use.

### Testing

To run the tests locally, you'll need to add a `test/.env` with your name and token values:

* `cp test/.env.sample test/.env`
* `accessToken` is derived from "APIs" > "Content Delivery API Keys" in the Contentful admin section.
* `spaceId` is also derived from "APIs" > "Content Delivery API Keys" in the Contentful admin section.

### License & Contributing

* Details on the license [can be found here](LICENSE.md)
* Details on running tests and contributing [can be found here](CONTRIBUTING.md)
