const cds = require("@sap/cds");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function isBase64(value) {
   return typeof value === "string" &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value) &&
      Buffer.from(value, "base64").toString("base64") === value;
}

function normalizeBinaryForStorage(request, sFieldName, iMaxBytes) {
   let data = request.data[sFieldName];
   if (!data) {
      return;
   }
   if (data instanceof Uint8Array) {
      const encoded = Buffer.from(data).toString("utf8");
      if (isBase64(encoded)) {
         data = encoded;
      }
   }
   if (typeof data !== "string") {
      return;
   }

   if (!isBase64(data)) {
      request.reject(400, sFieldName + " must be valid base64 data.");
      return;
   }
   const binary = Buffer.from(data, "base64");
   if (binary.length > iMaxBytes) {
      request.reject(400, sFieldName + " exceeds maximum allowed size of " + (iMaxBytes / (1024 * 1024)) + " MB.");
      return;
   }
   request.data[sFieldName] = binary;
}

function normalizeBinaryForOData(result, sFieldName) {
   const rows = Array.isArray(result) ? result : [result];
   rows.forEach(function (row) {
      if (row && row[sFieldName] instanceof Uint8Array) {
         const binary = Buffer.from(row[sFieldName]);
         const encoded = binary.toString("utf8");
         row[sFieldName] = isBase64(encoded)
            ? encoded
            : binary.toString("base64");
      }
   });
}

module.exports = cds.service.impl(function () {
   this.before(["CREATE", "UPDATE"], "Invoices", function (req) {
      normalizeBinaryForStorage(req, "ProductImage", MAX_IMAGE_BYTES);
      normalizeBinaryForStorage(req, "PdfDocument", MAX_DOCUMENT_BYTES);
   });
   this.after("READ", "Invoices", function (result) {
      normalizeBinaryForOData(result, "ProductImage");
      normalizeBinaryForOData(result, "PdfDocument");
   });
});
