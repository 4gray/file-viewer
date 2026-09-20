<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet
    version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:i="urn:example:invoice:v1"
    exclude-result-prefixes="i">

  <xsl:output method="html" omit-xml-declaration="yes"/>

  <xsl:template match="/">
    <article class="invoice">
      <h1>Invoice <xsl:value-of select="i:invoice/@number"/></h1>
      <p>
        Customer:
        <strong><xsl:value-of select="i:invoice/i:customer"/></strong>
      </p>
      <p>
        Total:
        <strong>
          <xsl:value-of select="i:invoice/i:total"/>
          <xsl:text> </xsl:text>
          <xsl:value-of select="i:invoice/i:total/@currency"/>
        </strong>
      </p>
    </article>
  </xsl:template>
</xsl:stylesheet>
