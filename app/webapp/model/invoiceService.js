sap.ui.define([], function () {
   "use strict";

   var sCollectionUrl = "/odata/v2/catalog/Invoices";
   var sCsrfToken = "";
   var sInvoiceFields = [
      "ID",
      "ProductName",
      "Quantity",
      "ExtendedPrice",
      "ShipperName",
      "ShippedDate",
      "Status"
   ].join(",");

   function getErrorMessage(oResponse, oBody) {
      if (oBody && oBody.error && oBody.error.message) {
         return oBody.error.message.value || oBody.error.message;
      }
      return oResponse.status + " " + oResponse.statusText;
   }

   function reportBackendError(sMessage) {
      try {
         var oMessageManager = sap.ui.getCore().getMessageManager();
         if (oMessageManager && sap.ui.core.message && sap.ui.core.message.Message) {
            oMessageManager.addMessages(new sap.ui.core.message.Message({
               message: sMessage,
               type: sap.ui.core.MessageType.Error,
               processor: null
            }));
         }
      } catch (e) {
         // suppress if UI5 core is not yet fully loaded
      }
   }

   function parseResponse(oResponse) {
      return oResponse.text().then(function (sText) {
         var oBody = sText ? JSON.parse(sText) : null;
         if (!oResponse.ok) {
            var sErrMsg = getErrorMessage(oResponse, oBody);
            reportBackendError(sErrMsg);
            throw new Error(sErrMsg);
         }
         return oBody;
      });
   }

   function request(sUrl, sMethod, oData) {
      var oOptions = {
         method: sMethod,
         credentials: "same-origin",
         headers: {
            Accept: "application/json"
         }
      };
      if (oData) {
         oOptions.headers["Content-Type"] = "application/json";
         oOptions.body = JSON.stringify(oData);
      }
      if (sMethod !== "GET") {
         oOptions.headers["X-CSRF-Token"] = sCsrfToken;
      }
      return fetch(sUrl, oOptions).then(parseResponse);
   }

   function fetchCsrfToken() {
      return fetch(sCollectionUrl, {
         method: "GET",
         credentials: "same-origin",
         headers: {
            Accept: "application/json",
            "X-CSRF-Token": "Fetch"
         }
      }).then(function (oResponse) {
         return parseResponse(oResponse).then(function () {
            sCsrfToken = oResponse.headers.get("X-CSRF-Token") || "";
         });
      });
   }

   function sendChange(sUrl, sMethod, oData) {
      return fetchCsrfToken().then(function () {
         return request(sUrl, sMethod, oData);
      });
   }

   function entityUrl(sId) {
      return sCollectionUrl + "(" + encodeURIComponent(sId) + ")";
   }

   return {
      readInvoices: function () {
         return request(sCollectionUrl + "?$select=" + sInvoiceFields, "GET").then(function (oBody) {
            return oBody.d.results;
         });
      },
      readInvoiceImage: function (sId) {
         return request(entityUrl(sId) + "?$select=ProductImage,ProductImageType", "GET");
      },
      readInvoiceDocument: function (sId) {
         return request(entityUrl(sId) + "?$select=PdfDocument,PdfDocumentType,PdfDocumentName", "GET");
      },
      createInvoice: function (oInvoice) {
         return sendChange(sCollectionUrl, "POST", oInvoice);
      },
      updateInvoice: function (sId, oInvoice) {
         var oChanges = {};
         Object.keys(oInvoice).forEach(function (sKey) {
            if (sKey !== "ID" && sKey.charAt(0) !== "@") {
               oChanges[sKey] = oInvoice[sKey];
            }
         });
         return sendChange(entityUrl(sId), "PATCH", oChanges);
      },
      updateInvoiceDocument: function (sId, sBase64, sType, sName) {
         return sendChange(entityUrl(sId), "PATCH", {
            PdfDocument: sBase64,
            PdfDocumentType: sType || "application/pdf",
            PdfDocumentName: sName || "invoice.pdf"
         });
      },
      deleteInvoiceDocument: function (sId) {
         return sendChange(entityUrl(sId), "PATCH", {
            PdfDocument: null,
            PdfDocumentType: null,
            PdfDocumentName: null
         });
      },
      deleteInvoice: function (sId) {
         return sendChange(entityUrl(sId), "DELETE");
      }
   };
});
