/**
 * Bio component that queries for data
 * with Gatsby's useStaticQuery component
 *
 * See: https://www.gatsbyjs.com/docs/use-static-query/
 */

import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTwitter, faGithub } from "@fortawesome/free-brands-svg-icons"

const Bio = () => {
  const icon = {
    twitter: <FontAwesomeIcon icon={faTwitter} />,
    github: <FontAwesomeIcon icon={faGithub} />,
  }

  return (
    <div className="bio">
      <a href="https://twitter.com/_kypu_">Twitter </a>/
      <a href="https://github.com/kypkyp">Github</a>
    </div>
  )
}

export default Bio
