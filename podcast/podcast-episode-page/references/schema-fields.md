# Schema fields reference

JSON-LD fields for the `PodcastEpisode` type. The skill writes `podcast_episode_schema` as nested YAML in the page frontmatter. Your site turns it into a `<script type="application/ld+json">` block at build time. If your site does not read frontmatter this way, convert it by hand or leave it out.

## Fields

Values in angle brackets come from the settings file or the episode. `<episode_url>` is `site.base_url` plus `site.episode_path`. `<series_url>` is `site.base_url` plus `site.index_path`.

```yaml
podcast_episode_schema:
  '@context': 'https://schema.org'
  '@type': PodcastEpisode
  '@id': '<episode_url>'
  name: "<show.name> with <Guest Name>"
  description: <episode summary, 250 to 400 chars>
  episodeNumber: N
  partOfSeries:
    '@type': PodcastSeries
    '@id': '<series_url>'
    name: '<show.name>'
    url: '<series_url>'
  associatedMedia:
    '@type': MediaObject
    '@id': '<youtube_url>'
    contentUrl: '<youtube_url>'
    encodingFormat: 'video/mp4'
    duration: 'PT<H>H<M>M<S>S'
  datePublished: 'YYYY-MM-DD'
  dateCreated: 'YYYY-MM-DD'
  thumbnailUrl: '<episode_url>/thumbnail.png'
  inLanguage: '<show.language>'
  author:
    '@type': Person
    '@id': '<show.publisher_url>#host'
    name: '<show.host>'
    url: '<show.publisher_url>'
    sameAs:
      - '<show.host_linkedin>'
  contributor:
    '@type': Person
    name: '<Guest Name>'
    url: '<guest_linkedin>'
    jobTitle: '<Guest Role>'
    worksFor:
      '@type': Organization
      name: '<Guest Company>'
  publisher:
    '@type': Organization
    '@id': '<show.publisher_url>#organization'
    name: '<show.publisher>'
    url: '<show.publisher_url>'
```

## ISO 8601 duration helper

| duration_seconds | ISO 8601 |
|------------------|----------|
| 1800 (30m 0s) | `PT30M` |
| 1834 (30m 34s) | `PT30M34S` |
| 3661 (1h 1m 1s) | `PT1H1M1S` |
| 4500 (1h 15m 0s) | `PT1H15M` |

Omit zero components. Always start with `PT`.

## Cross-referencing with `@id`

Anything that appears on several pages should keep a stable `@id`, so the graph joins up across the site.

| Entity | Stable `@id` |
|--------|--------------|
| Publisher | `<show.publisher_url>#organization` |
| Series | `<series_url>` |
| Host | `<show.publisher_url>#host` |
| This episode | `<episode_url>` |

## What to leave out

- The guest's email or phone
- Internal IDs from any CMS
- Tracking pixels
