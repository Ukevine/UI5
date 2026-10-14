sap.ui.define([
   "sap/ui/core/mvc/Controller",
   "sap/m/MessageToast",
   "sap/ui/model/json/JSONModel",
   "sap/m/MessageBox",
   "sap/ui/core/Fragment",
   "sap/ui/core/message/Message",
   "sap/ui/core/MessageType",
   "sap/ui/webapp/wt/model/invoiceService",
   "sap/ui/webapp/wt/model/formatter"
], function (Controller, MessageToast, JSONModel, MessageBox, Fragment, Message, MessageType, invoiceService, formatter) {
   "use strict";

   var SAMPLE_PDF_BASE64 = "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL01lZGlhQm94WzAgMCA2MTIgNzkyXS9QYXJlbnQgMiAwIFIvUmVzb3VyY2VzPDw+Pj4+ZW5kb2JqCnhyZWYKMCA0CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDUyIDAwMDAwIG4gCjAwMDAwMDAxMDEgMDAwMDAgbiAKdHJhaWxlcjw8L1NpemUgNC9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjE3OAolJUVPRgo=";

   return Controller.extend("sap.ui.webapp.wt.controller.Detail", {
      formatter: formatter,

      onInit: function () {
         var oViewModel = new JSONModel({
            currency: "EUR",
            editing: false,
            imageLoading: false,
            imageReading: false,
            imageSaving: false,
            pdfLoading: false,
            pdfSaving: false,
            pdfSource: "",
            invoiceActionBusy: false,
            messageCount: 0,
            errorCount: 0
         });
         this.getView().setModel(oViewModel, "view");

         var oImageUploader = this.byId("productImageUploader");
         if (oImageUploader) {
            oImageUploader.setMimeType([
               "image/jpeg",
               "image/png",
               "image/webp"
            ]);
         }

         // MessageManager integration for MessagePopover
         var oMessageModel = sap.ui.getCore().getMessageManager().getMessageModel();
         oMessageModel.bindList("/").attachChange(this._updateMessageStats, this);
         this._updateMessageStats();

         // Router pattern matching
         var oRouter = this.getOwnerComponent().getRouter();
         oRouter.getRoute("detail").attachPatternMatched(function (oEvent) {
            this.getView().getModel("view").setProperty("/editing", false);
            this._onObjectMatched(oEvent);
         }, this);
         oRouter.getRoute("edit").attachPatternMatched(function (oEvent) {
            this._onObjectMatched(oEvent);
            this.onEdit();
         }, this);
      },

      _updateMessageStats: function () {
         var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData() || [];
         var iErrors = aMessages.filter(function (oMsg) {
            return oMsg.type === MessageType.Error;
         }).length;
         var oViewModel = this.getView().getModel("view");
         if (oViewModel) {
            oViewModel.setProperty("/messageCount", aMessages.length);
            oViewModel.setProperty("/errorCount", iErrors);
         }
      },

      _onObjectMatched: function (oEvent) {
         this._iImageReadToken = (this._iImageReadToken || 0) + 1;
         var oViewModel = this.getView().getModel("view");
         oViewModel.setProperty("/imageReading", false);
         oViewModel.setProperty("/imageSaving", false);
         oViewModel.setProperty("/pdfSaving", false);

         var sInvoiceId = decodeURIComponent(
            oEvent.getParameter("arguments").invoiceId
         );
         var aInvoices = this.getOwnerComponent().getModel("invoice")
            .getProperty("/Invoices") || [];
         var iInvoiceIndex = aInvoices.findIndex(function (oInvoice) {
            return String(oInvoice.ID) === sInvoiceId;
         });
         if (iInvoiceIndex < 0) {
            MessageBox.error("The selected invoice could not be found.");
            this.getOwnerComponent().getRouter().navTo("overview", {}, true);
            return;
         }
         this._sInvoicePath = "/Invoices/" + iInvoiceIndex;
         this._sInvoiceId = sInvoiceId;
         oViewModel.setProperty("/imageLoading", true);
         oViewModel.setProperty("/pdfLoading", true);
         oViewModel.setProperty("/pdfSource", "");

         var oInvoiceModel = this.getOwnerComponent().getModel("invoice");
         oInvoiceModel.setProperty(this._sInvoicePath + "/ProductImage", null);
         oInvoiceModel.setProperty(this._sInvoicePath + "/ProductImageType", null);

         // Bind the view to the invoice
         this.getView().bindElement({
            path: this._sInvoicePath,
            model: "invoice"
         });

         // Load Product Image
         invoiceService.readInvoiceImage(sInvoiceId).then(function (oImage) {
            if (this._sInvoiceId !== sInvoiceId) {
               return;
            }
            oInvoiceModel.setProperty(
               this._sInvoicePath + "/ProductImage",
               oImage.ProductImage || null
            );
            oInvoiceModel.setProperty(
               this._sInvoicePath + "/ProductImageType",
               oImage.ProductImageType || null
            );
            if (this._oOriginalInvoice && String(this._oOriginalInvoice.ID) === sInvoiceId) {
               this._oOriginalInvoice.ProductImage = oImage.ProductImage || null;
               this._oOriginalInvoice.ProductImageType = oImage.ProductImageType || null;
            }
         }.bind(this)).catch(function (oError) {
            if (this._sInvoiceId === sInvoiceId) {
               MessageBox.error("Could not load the product picture: " + oError.message);
            }
         }.bind(this)).finally(function () {
            if (this._sInvoiceId === sInvoiceId) {
               oViewModel.setProperty("/imageLoading", false);
            }
         }.bind(this));

         // Load Invoice PDF Document
         invoiceService.readInvoiceDocument(sInvoiceId).then(function (oDoc) {
            if (this._sInvoiceId !== sInvoiceId) {
               return;
            }
            if (oDoc && oDoc.PdfDocument) {
               var sType = oDoc.PdfDocumentType || "application/pdf";
               var sPdfSource = "data:" + sType + ";base64," + oDoc.PdfDocument;
               oViewModel.setProperty("/pdfSource", sPdfSource);
            } else {
               oViewModel.setProperty("/pdfSource", "");
            }
         }.bind(this)).catch(function (oError) {
            if (this._sInvoiceId === sInvoiceId) {
               oViewModel.setProperty("/pdfSource", "");
            }
         }.bind(this)).finally(function () {
            if (this._sInvoiceId === sInvoiceId) {
               oViewModel.setProperty("/pdfLoading", false);
            }
         }.bind(this));

         // Set up the ratings model for this invoice
         var sRatingKey = "product_" + sInvoiceId.replace(/[^A-Za-z0-9_]/g, "_");
         var oRatingsModel = this.getOwnerComponent().getModel("ratings");

         if (oRatingsModel.getProperty("/" + sRatingKey) === undefined) {
            oRatingsModel.setProperty("/" + sRatingKey, 0);
         }

         // Bind the ProductRating control to the ratings model
         var oProductRating = this.byId("productRating");
         if (oProductRating) {
            oProductRating.bindProperty("value", {
               path: "ratings>/" + sRatingKey
            });
            oProductRating.reset();
         }
      },

      onEdit: function () {
         var oInvoiceModel = this.getOwnerComponent().getModel("invoice");
         this._oOriginalInvoice = JSON.parse(JSON.stringify(
            oInvoiceModel.getProperty(this._sInvoicePath)
         ));
         this.getView().getModel("view").setProperty("/editing", true);
      },

      onSave: function () {
         var oViewModel = this.getView().getModel("view");
         if (oViewModel.getProperty("/imageLoading") ||
             oViewModel.getProperty("/imageReading") ||
             oViewModel.getProperty("/imageSaving") ||
             oViewModel.getProperty("/pdfLoading") ||
             oViewModel.getProperty("/pdfSaving")) {
            return;
         }
         var oInvoice = this.getOwnerComponent().getModel("invoice")
            .getProperty(this._sInvoicePath);
         if (!oInvoice.ProductName || !oInvoice.ProductName.trim() ||
             !oInvoice.ShipperName || !oInvoice.ShipperName.trim()) {
            MessageToast.show(this.getView().getModel("i18n").getResourceBundle()
               .getText("productNameSupplierRequired"));
            return;
         }

         oViewModel.setProperty("/invoiceActionBusy", true);
         invoiceService.updateInvoice(oInvoice.ID, oInvoice).then(function () {
            this._oOriginalInvoice = null;
            oViewModel.setProperty("/editing", false);
            MessageToast.show(this.getView().getModel("i18n").getResourceBundle()
               .getText("productSaved"));
         }.bind(this)).catch(function (oError) {
            this.getOwnerComponent().getModel("invoice")
               .setProperty(this._sInvoicePath, this._oOriginalInvoice);
            MessageBox.error("Could not save changes to the CAP service: " + oError.message);
         }.bind(this)).finally(function () {
            oViewModel.setProperty("/invoiceActionBusy", false);
         });
      },

      onCancelEdit: function () {
         this._iImageReadToken = (this._iImageReadToken || 0) + 1;
         if (this._oOriginalInvoice) {
            this.getOwnerComponent().getModel("invoice")
               .setProperty(this._sInvoicePath, this._oOriginalInvoice);
         }
         this._oOriginalInvoice = null;
         var oViewModel = this.getView().getModel("view");
         oViewModel.setProperty("/editing", false);
         oViewModel.setProperty("/imageReading", false);
         var oUploader = this.byId("productImageUploader");
         if (oUploader) {
            oUploader.clear();
         }
      },

      onImageSelected: function (oEvent) {
         var oFileUploader = oEvent.getSource();
         var aFiles = oEvent.getParameter("files");
         var oFile = aFiles && aFiles[0];
         if (!oFile) {
            var oInput = oFileUploader.getFocusDomRef();
            oFile = oInput && oInput.files && oInput.files[0];
         }
         if (!oFile) {
            return;
         }

         var aAllowedTypes = ["image/jpeg", "image/png", "image/webp"];
         if (aAllowedTypes.indexOf(oFile.type) < 0 || oFile.size > 5 * 1024 * 1024) {
            MessageBox.error(this.getView().getModel("i18n")
               .getResourceBundle().getText("productImageInvalid"));
            oFileUploader.clear();
            return;
         }

         var sInvoiceId = this._sInvoiceId;
         var oInvoiceModel = this.getOwnerComponent().getModel("invoice");
         var sPreviousImage = oInvoiceModel.getProperty(this._sInvoicePath + "/ProductImage");
         var sPreviousImageType = oInvoiceModel.getProperty(this._sInvoicePath + "/ProductImageType");
         var iReadToken = (this._iImageReadToken || 0) + 1;
         this._iImageReadToken = iReadToken;
         var oReader = new FileReader();
         this.getView().getModel("view").setProperty("/imageReading", true);

         oReader.onload = function () {
            if (this._sInvoiceId !== sInvoiceId || this._iImageReadToken !== iReadToken || typeof oReader.result !== "string") {
               return;
            }
            var sBase64 = oReader.result.split(",")[1];
            if (!sBase64) {
               this.getView().getModel("view").setProperty("/imageReading", false);
               MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("productImageReadFailed"));
               return;
            }
            oInvoiceModel.setProperty(this._sInvoicePath + "/ProductImage", sBase64);
            oInvoiceModel.setProperty(this._sInvoicePath + "/ProductImageType", oFile.type);
            this.getView().getModel("view").setProperty("/imageReading", false);
            this.getView().getModel("view").setProperty("/imageSaving", true);

            invoiceService.updateInvoice(sInvoiceId, {
               ProductImage: sBase64,
               ProductImageType: oFile.type
            }).then(function () {
               if (this._sInvoiceId === sInvoiceId && this._oOriginalInvoice && String(this._oOriginalInvoice.ID) === sInvoiceId) {
                  this._oOriginalInvoice.ProductImage = sBase64;
                  this._oOriginalInvoice.ProductImageType = oFile.type;
               }
               MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("productImageSaved"));
            }.bind(this)).catch(function (oError) {
               if (this._sInvoiceId === sInvoiceId) {
                  oInvoiceModel.setProperty(this._sInvoicePath + "/ProductImage", sPreviousImage || null);
                  oInvoiceModel.setProperty(this._sInvoicePath + "/ProductImageType", sPreviousImageType || null);
                  MessageBox.error("Could not save the product picture: " + oError.message);
               }
            }.bind(this)).finally(function () {
               if (this._sInvoiceId === sInvoiceId) {
                  this.getView().getModel("view").setProperty("/imageSaving", false);
               }
               oFileUploader.clear();
            }.bind(this));
         }.bind(this);

         oReader.onerror = function () {
            if (this._sInvoiceId === sInvoiceId && this._iImageReadToken === iReadToken) {
               this.getView().getModel("view").setProperty("/imageReading", false);
               MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("productImageReadFailed"));
            }
         }.bind(this);
         oReader.readAsDataURL(oFile);
      },

      onRemoveImage: function () {
         var oViewModel = this.getView().getModel("view");
         if (oViewModel.getProperty("/imageReading") || oViewModel.getProperty("/imageSaving")) {
            return;
         }
         var oInvoiceModel = this.getOwnerComponent().getModel("invoice");
         var sInvoiceId = this._sInvoiceId;
         var sPreviousImage = oInvoiceModel.getProperty(this._sInvoicePath + "/ProductImage");
         var sPreviousImageType = oInvoiceModel.getProperty(this._sInvoicePath + "/ProductImageType");
         oViewModel.setProperty("/imageSaving", true);
         oInvoiceModel.setProperty(this._sInvoicePath + "/ProductImage", null);
         oInvoiceModel.setProperty(this._sInvoicePath + "/ProductImageType", null);

         invoiceService.updateInvoice(sInvoiceId, {
            ProductImage: null,
            ProductImageType: null
         }).then(function () {
            if (this._sInvoiceId === sInvoiceId && this._oOriginalInvoice && String(this._oOriginalInvoice.ID) === sInvoiceId) {
               this._oOriginalInvoice.ProductImage = null;
               this._oOriginalInvoice.ProductImageType = null;
            }
            MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("productImageRemoved"));
         }.bind(this)).catch(function (oError) {
            if (this._sInvoiceId === sInvoiceId) {
               oInvoiceModel.setProperty(this._sInvoicePath + "/ProductImage", sPreviousImage || null);
               oInvoiceModel.setProperty(this._sInvoicePath + "/ProductImageType", sPreviousImageType || null);
               MessageBox.error("Could not remove the product picture: " + oError.message);
            }
         }.bind(this)).finally(function () {
            if (this._sInvoiceId === sInvoiceId) {
               oViewModel.setProperty("/imageSaving", false);
            }
         }.bind(this));
      },

      // PDF document handling & PDFViewer
      onPdfSelected: function (oEvent) {
         var oFileUploader = oEvent.getSource();
         var aFiles = oEvent.getParameter("files");
         var oFile = aFiles && aFiles[0];
         if (!oFile) {
            var oInput = oFileUploader.getFocusDomRef();
            oFile = oInput && oInput.files && oInput.files[0];
         }
         if (!oFile) {
            return;
         }

         var oBundle = this.getView().getModel("i18n").getResourceBundle();
         if (oFile.type !== "application/pdf" && !oFile.name.toLowerCase().endsWith(".pdf")) {
            MessageBox.error(oBundle.getText("pdfDocumentInvalid"));
            oFileUploader.clear();
            return;
         }
         if (oFile.size > 10 * 1024 * 1024) {
            MessageBox.error(oBundle.getText("pdfDocumentInvalid"));
            oFileUploader.clear();
            return;
         }

         var sInvoiceId = this._sInvoiceId;
         var oViewModel = this.getView().getModel("view");
         oViewModel.setProperty("/pdfLoading", true);
         oViewModel.setProperty("/pdfSaving", true);

         var oReader = new FileReader();
         oReader.onload = function () {
            if (typeof oReader.result !== "string") {
               oViewModel.setProperty("/pdfLoading", false);
               oViewModel.setProperty("/pdfSaving", false);
               MessageBox.error(oBundle.getText("pdfDocumentReadFailed"));
               return;
            }
            var sDataUrl = oReader.result;
            var sBase64 = sDataUrl.split(",")[1];

            invoiceService.updateInvoiceDocument(sInvoiceId, sBase64, oFile.type, oFile.name).then(function () {
               oViewModel.setProperty("/pdfSource", sDataUrl);
               MessageToast.show(oBundle.getText("pdfDocumentSaved"));
            }).catch(function (oError) {
               MessageBox.error(oError.message);
            }).finally(function () {
               oViewModel.setProperty("/pdfLoading", false);
               oViewModel.setProperty("/pdfSaving", false);
               oFileUploader.clear();
            });
         }.bind(this);

         oReader.onerror = function () {
            oViewModel.setProperty("/pdfLoading", false);
            oViewModel.setProperty("/pdfSaving", false);
            MessageBox.error(oBundle.getText("pdfDocumentReadFailed"));
         };
         oReader.readAsDataURL(oFile);
      },

      onRemovePdf: function () {
         var sInvoiceId = this._sInvoiceId;
         var oViewModel = this.getView().getModel("view");
         var oBundle = this.getView().getModel("i18n").getResourceBundle();

         oViewModel.setProperty("/pdfLoading", true);
         oViewModel.setProperty("/pdfSaving", true);

         invoiceService.deleteInvoiceDocument(sInvoiceId).then(function () {
            oViewModel.setProperty("/pdfSource", "");
            MessageToast.show(oBundle.getText("pdfDocumentRemoved"));
         }).catch(function (oError) {
            MessageBox.error(oError.message);
         }).finally(function () {
            oViewModel.setProperty("/pdfLoading", false);
            oViewModel.setProperty("/pdfSaving", false);
         });
      },

      onDownloadPdf: function () {
         var sSource = this.getView().getModel("view").getProperty("/pdfSource");
         if (!sSource) {
            return;
         }
         var oLink = document.createElement("a");
         oLink.href = sSource;
         oLink.download = "invoice_" + (this._sInvoiceId || "document") + ".pdf";
         document.body.appendChild(oLink);
         oLink.click();
         document.body.removeChild(oLink);
      },

      onLoadSamplePdf: function () {
         var sInvoiceId = this._sInvoiceId;
         var oViewModel = this.getView().getModel("view");
         var oBundle = this.getView().getModel("i18n").getResourceBundle();

         oViewModel.setProperty("/pdfLoading", true);
         oViewModel.setProperty("/pdfSaving", true);

         invoiceService.updateInvoiceDocument(sInvoiceId, SAMPLE_PDF_BASE64, "application/pdf", "sample_invoice.pdf").then(function () {
            oViewModel.setProperty("/pdfSource", "data:application/pdf;base64," + SAMPLE_PDF_BASE64);
            MessageToast.show(oBundle.getText("pdfDocumentSaved"));
         }).catch(function (oError) {
            MessageBox.error(oError.message);
         }).finally(function () {
            oViewModel.setProperty("/pdfLoading", false);
            oViewModel.setProperty("/pdfSaving", false);
         });
      },

      onPdfLoaded: function () {
         this.getView().getModel("view").setProperty("/pdfLoading", false);
         var oBundle = this.getView().getModel("i18n").getResourceBundle();
         MessageToast.show(oBundle.getText("pdfDocumentLoaded"));
      },

      onPdfError: function () {
         this.getView().getModel("view").setProperty("/pdfLoading", false);
         var oBundle = this.getView().getModel("i18n").getResourceBundle();
         var sMsg = oBundle.getText("pdfDocumentError");

         try {
            var oMessageManager = sap.ui.getCore().getMessageManager();
            oMessageManager.addMessages(new Message({
               message: sMsg,
               type: MessageType.Error,
               processor: null
            }));
         } catch (e) {
            // ignore
         }
      },

      onPdfSourceValidationFailed: function (oEvent) {
         this.getView().getModel("view").setProperty("/pdfLoading", false);
      },

      onMessagePopoverPress: function (oEvent) {
         var oButton = oEvent.getSource();
         var oView = this.getView();
         if (!this._pMessagePopover) {
            this._pMessagePopover = Fragment.load({
               id: oView.getId(),
               name: "sap.ui.webapp.wt.view.MessagePopover",
               controller: this
            }).then(function (oPopover) {
               oView.addDependent(oPopover);
               return oPopover;
            });
         }
         this._pMessagePopover.then(function (oPopover) {
            oPopover.toggle(oButton);
         });
      },

      onNavigateToInvoices: function () {
         if (this.getView().getModel("view").getProperty("/editing")) {
            this.onCancelEdit();
         }
         var oRouter = this.getOwnerComponent().getRouter();
         oRouter.navTo("overview", {}, true);
      },

      onDeleteInvoice: function () {
         var oInvoice = this.getOwnerComponent().getModel("invoice")
            .getProperty(this._sInvoicePath);
         var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
         MessageBox.confirm(oResourceBundle.getText("confirmDeleteInvoice", [
            oInvoice.ProductName
         ]), {
            onClose: function (sAction) {
               if (sAction !== MessageBox.Action.OK) {
                  return;
               }
               var oViewModel = this.getView().getModel("view");
               oViewModel.setProperty("/invoiceActionBusy", true);
               invoiceService.deleteInvoice(oInvoice.ID).then(function () {
                  var oInvoiceModel = this.getOwnerComponent().getModel("invoice");
                  var aInvoices = oInvoiceModel.getProperty("/Invoices") || [];
                  oInvoiceModel.setProperty("/Invoices", aInvoices.filter(
                     function (oItem) {
                        return String(oItem.ID) !== String(oInvoice.ID);
                     }
                  ));
                  MessageToast.show(oResourceBundle.getText("invoiceDeleted"));
                  this.getOwnerComponent().getRouter().navTo("overview", {}, true);
               }.bind(this)).catch(function (oError) {
                  MessageBox.error(oResourceBundle.getText("invoiceDeleteFailed") +
                     "\n" + oError.message);
               }.bind(this)).finally(function () {
                  oViewModel.setProperty("/invoiceActionBusy", false);
               });
            }.bind(this)
         });
      },

      onCopyInvoice: function () {
         var oInvoice = JSON.parse(JSON.stringify(
            this.getOwnerComponent().getModel("invoice")
               .getProperty(this._sInvoicePath)
         ));
         delete oInvoice.ID;
         Object.keys(oInvoice).forEach(function (sKey) {
            if (sKey.charAt(0) === "@") {
               delete oInvoice[sKey];
            }
         });

         var oViewModel = this.getView().getModel("view");
         var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
         oViewModel.setProperty("/invoiceActionBusy", true);
         invoiceService.createInvoice(oInvoice).then(function (oCreatedInvoice) {
            if (!oCreatedInvoice || !oCreatedInvoice.ID) {
               throw new Error("The CAP service did not return the new invoice ID.");
            }
            var oInvoiceModel = this.getOwnerComponent().getModel("invoice");
            var aInvoices = oInvoiceModel.getProperty("/Invoices") || [];
            oInvoiceModel.setProperty("/Invoices", aInvoices.concat([oCreatedInvoice]));
            MessageToast.show(oResourceBundle.getText("invoiceCopied"));
            this.getOwnerComponent().getRouter().navTo("detail", {
               invoiceId: encodeURIComponent(oCreatedInvoice.ID)
            });
         }.bind(this)).catch(function (oError) {
            MessageBox.error(oResourceBundle.getText("invoiceCopyFailed") +
               "\n" + oError.message);
         }.bind(this)).finally(function () {
            oViewModel.setProperty("/invoiceActionBusy", false);
         });
      },

      onShareInvoice: function () {
         var oInvoice = this.getOwnerComponent().getModel("invoice")
            .getProperty(this._sInvoicePath);
         var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
         var sUrl = window.location.href;
         var oShareData = {
            title: oInvoice.ProductName,
            text: oResourceBundle.getText("shareInvoiceText", [oInvoice.ProductName]),
            url: sUrl
         };

         if (navigator.share) {
            navigator.share(oShareData).catch(function (oError) {
               if (oError.name !== "AbortError") {
                  MessageBox.error(oResourceBundle.getText("invoiceShareFailed") +
                     "\n" + oError.message);
               }
            });
            return;
         }
         if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(sUrl).then(function () {
               MessageToast.show(oResourceBundle.getText("invoiceLinkCopied"));
            }).catch(function (oError) {
               MessageBox.error(oResourceBundle.getText("invoiceShareFailed") +
                  "\n" + oError.message);
            });
            return;
         }
         MessageBox.error(oResourceBundle.getText("invoiceShareUnavailable"));
      },

      onRatingChange: function (oEvent) {
         var fValue = oEvent.getParameter("value");
         var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

         MessageToast.show(
            oResourceBundle.getText("ratingConfirmation", [fValue])
         );
      }
   });
});