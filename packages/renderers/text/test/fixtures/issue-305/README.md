# Issue 305 fixtures

These synthetic, redistributable fixtures originate from the issue author's
[sample zip](https://github.com/user-attachments/files/32380412/flyfish-xml-profile-sample-v2.zip)
in [issue 305](https://github.com/flyfish-dev/file-viewer/issues/305).
They contain no customer data. The XML, XSD and XSLT contents are preserved.
The manifest omits the sample's redundant `require: "all"`: all enabled checks
always have to pass. Relative resource paths intentionally share the manifest's directory.

- `invoice-valid.xml`: required structure, attributes and decimal value pass XSD.
- `invoice-invalid.xml`: same root and namespace, but the required total is absent.
- `invoice.xsd`: XML Schema 1.0, including required elements and an attribute on decimal content.
- `invoice.xsl`: XSLT 1.0, producing an HTML invoice using namespace-aware XPath.
- `profiles.json`: both checks enabled. Tests derive XSD-only, root-only and ambiguous variants.
