/**
 * BioComponent component that queries for data
 * with Gatsby's useStaticQuery component
 *
 * See: https://www.gatsbyjs.org/docs/use-static-query/
 */

import React from "react"
import { useStaticQuery, graphql, Link } from "gatsby"

import { rhythm } from "../utils/typography"

const BioComponent = () => {
  const data = useStaticQuery(graphql`
    query BioComponentQuery {
      site {
        siteMetadata {
          social {
            twitter
          }
        }
      }
    }
  `)

  const { social } = data.site.siteMetadata
  return (
    <div
      style={{
        display: `flex`,
        flexDirection: `column`,
        marginBottom: rhythm(1.5),
      }}
    >
      <div>
        <Link to={`/work`} >
          work
        </Link>
      </div>
      <div>
        <Link to={`/talks`} >
          talks
        </Link>
      </div>
      <div>
        <a href={`https://github.com/indraneel`} target={`_blank`}>
          github
        </a>
      </div>
      <div>
        <a href={`https://twitter.com/${social.twitter}`} target={`_blank`}>
          twitter
        </a>
      </div>
    </div>
  )
}

export default BioComponent
