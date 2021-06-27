import React from "react"
import { graphql } from "gatsby"

import Layout from "../components/layout"
import BioComponent from "../components/Bio"
import SEO from "../components/seo"
import { rhythm, scale } from "../utils/typography"

const TalksPage = ({ data, location }) => {
  const siteTitle = data.site.siteMetadata.title

  return (
    <Layout location={location} title={siteTitle}>
        <SEO title="Talks" />
        <BioComponent />
        <h1>Talks</h1>
        <article>
	   Talks I've given. 
        </article>
        <article>
            <header>
                <h2
                    style={{marginBottom: rhythm(1 / 4)}}>
                    Championing fair election maps with open data, law, and math (@ Mapbox)
                </h2>
                <h3>October 2020</h3>
            </header>
            <section>
                <iframe width="560" height="315" src="https://www.youtube.com/embed/Dm08YaTlnSs" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </section>
        </article>
        <article>
            <header>
                <h2
                    style={{marginBottom: rhythm(1 / 4)}}>
                    SharedStreets Road Closures (@ State of the Map US 2019)
                </h2>
                <h3>September 2019</h3>
            </header>
            <section>
                <iframe width="560" height="315" src="https://www.youtube.com/embed/ROemNM73E2c" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </section>
        </article>
        <article>
            <header>
                <h2
                    style={{marginBottom: rhythm(1 / 4)}}>
                    SharedStreets Road Closures (@ Transit Techies NYC)
                </h2>
                <h3>September 2019</h3>
            </header>
            <section>
                <iframe width="560" height="315" src="https://www.youtube.com/embed/LUbZs_Kv-Pg" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </section>
        </article>

    </Layout>
  )
}

export default TalksPage;

export const pageQuery = graphql`
  query {
    site {
      siteMetadata {
        title
      }
    }
    allFile(filter: {sourceInstanceName: {eq: "assets"}}) {
        nodes {
          id
          publicURL
          name
        }
      }
  }
`
