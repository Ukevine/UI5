sap.ui.define([
   "sap/ui/base/ManagedObject",
   "sap/ui/core/Fragment",
   "sap/ui/model/json/JSONModel",
   "sap/m/MessageBox",
   "sap/m/MessageToast",
   "sap/ui/core/message/Message",
   "sap/ui/core/MessageType",
   "sap/ui/webapp/wt/model/invoiceService"
], function (ManagedObject, Fragment, JSONModel, MessageBox, MessageToast, Message, MessageType, invoiceService) {
   "use strict";

   return ManagedObject.extend("sap.ui.webapp.wt.controller.CreateInvoiceDialog", {

      constructor: function (oParentView) {
         this._oParentView = oParentView;
      },

      open: function (fnOnCreated) {
         this._fnOnCreated = fnOnCreated;
         var oView = this._oParentView;
         var oCatalog = this._getFoodCatalog();
         var aProducts = oCatalog.products.map(function (oProduct) {
            return { ID: oProduct.ID, Name: oProduct.Name, UnitPrice: oProduct.UnitPrice };
         });
         var aSuppliers = oCatalog.suppliers.slice();

         var oNewInvoiceModel = new JSONModel({
            ProductName: "",
            Quantity: "",
            UnitPrice: "",
            ShipperName: "",
            Status: "A",
            products: [{ ID: "", Name: this._getText("invoiceChooseProduct") }].concat(aProducts),
            suppliers: [{ ID: "", Name: this._getText("invoiceChooseSupplier") }].concat(aSuppliers),
            selectedProduct: "",
            selectedSupplier: "",
            creatingProduct: !aProducts.length,
            creatingSupplier: !aSuppliers.length,
            productStepValid: false,
            supplierStepValid: false,
            validationAttempted: false,
            touchedFields: {},
            ProductNameState: "None",
            ProductNameStateText: "",
            QuantityState: "None",
            QuantityStateText: "",
            UnitPriceState: "None",
            UnitPriceStateText: "",
            ShipperNameState: "None",
            ShipperNameStateText: "",
            productValidationMessage: "",
            supplierValidationMessage: "",
            statusText: this._getText("statusNew"),
            total: "",
            busy: false
         });
         oView.setModel(oNewInvoiceModel, "newInvoice");

         if (!this._pDialog) {
            this._pDialog = Fragment.load({
               id: oView.getId(),
               name: "sap.ui.webapp.wt.view.CreateInvoiceDialog",
               controller: this
            }).then(function (oDialog) {
               oView.addDependent(oDialog);
               this._attachInvoiceFieldBlurValidation(oView);
               return oDialog;
            }.bind(this)).catch(function (oError) {
               this._pDialog = null;
               throw oError;
            }.bind(this));
         }

         this._pDialog.then(function (oDialog) {
            var oWizard = Fragment.byId(oView.getId(), "createInvoiceWizard");
            if (oWizard) {
               oWizard.discardProgress(Fragment.byId(oView.getId(), "invoiceProductStep"));
            }
            this._validateNewInvoice();
            oDialog.open();
         }.bind(this)).catch(function (oError) {
            MessageBox.error(this._getText("createDialogOpenFailed", [oError.message]));
         }.bind(this));
      },

      onInvoiceProductSelect: function (oEvent) {
         var oModel = this._oParentView.getModel("newInvoice");
         var sProductId = oEvent.getSource().getSelectedKey();
         var oProduct = oModel.getProperty("/products").find(function (oItem) {
            return String(oItem.ID) === String(sProductId);
         });
         oModel.setProperty("/selectedProduct", sProductId);
         oModel.setProperty("/ProductName", oProduct && oProduct.ID ? oProduct.Name : "");
         oModel.setProperty("/UnitPrice", oProduct && oProduct.UnitPrice > 0
            ? oProduct.UnitPrice.toFixed(2)
            : "");
         this._validateNewInvoice(false, ["ProductName", "UnitPrice"], true);
      },

      onInvoiceSupplierSelect: function (oEvent) {
         var oModel = this._oParentView.getModel("newInvoice");
         var sSupplierId = oEvent.getSource().getSelectedKey();
         var oSupplier = oModel.getProperty("/suppliers").find(function (oItem) {
            return String(oItem.ID) === String(sSupplierId);
         });
         oModel.setProperty("/selectedSupplier", sSupplierId);
         oModel.setProperty("/ShipperName", oSupplier && oSupplier.ID ? oSupplier.Name : "");
         this._validateNewInvoice(false, ["ShipperName"], true);
      },

      onStartCreateInvoiceProduct: function () {
         var oModel = this._oParentView.getModel("newInvoice");
         oModel.setProperty("/creatingProduct", true);
         oModel.setProperty("/selectedProduct", "");
         oModel.setProperty("/ProductName", "");
         oModel.setProperty("/UnitPrice", "");
         this._validateNewInvoice(false, ["ProductName", "UnitPrice"]);
      },

      onCancelCreateInvoiceProduct: function () {
         var oModel = this._oParentView.getModel("newInvoice");
         oModel.setProperty("/creatingProduct", false);
         oModel.setProperty("/ProductName", "");
         oModel.setProperty("/UnitPrice", "");
         this._validateNewInvoice(false, ["ProductName", "UnitPrice"]);
      },

      onStartCreateInvoiceSupplier: function () {
         var oModel = this._oParentView.getModel("newInvoice");
         oModel.setProperty("/creatingSupplier", true);
         oModel.setProperty("/selectedSupplier", "");
         oModel.setProperty("/ShipperName", "");
         this._validateNewInvoice(false, ["ShipperName"]);
      },

      onCancelCreateInvoiceSupplier: function () {
         var oModel = this._oParentView.getModel("newInvoice");
         oModel.setProperty("/creatingSupplier", false);
         oModel.setProperty("/ShipperName", "");
         this._validateNewInvoice(false, ["ShipperName"]);
      },

      onInvoiceWizardInputChange: function (oEvent) {
         var oModel = this._oParentView.getModel("newInvoice");
         var sInputId = oEvent.getSource().getId().split("--").pop();
         var sValue = oEvent.getParameter("value");
         var sChangedField;
         if (sInputId === "inputProductName") {
            oModel.setProperty("/ProductName", sValue);
            sChangedField = "ProductName";
         } else if (sInputId === "inputQuantity") {
            oModel.setProperty("/Quantity", sValue);
            sChangedField = "Quantity";
         } else if (sInputId === "inputUnitPrice") {
            oModel.setProperty("/UnitPrice", sValue);
            sChangedField = "UnitPrice";
         } else if (sInputId === "inputSupplier") {
            oModel.setProperty("/ShipperName", sValue);
            sChangedField = "ShipperName";
         }
         this._validateNewInvoice(false, sChangedField ? [sChangedField] : []);
      },

      _attachInvoiceFieldBlurValidation: function (oView) {
         [
            { id: "existingProductSelect", field: "ProductName" },
            { id: "inputProductName", field: "ProductName" },
            { id: "inputQuantity", field: "Quantity" },
            { id: "inputUnitPrice", field: "UnitPrice" },
            { id: "existingSupplierSelect", field: "ShipperName" },
            { id: "inputSupplier", field: "ShipperName" }
         ].forEach(function (oField) {
            var oInput = Fragment.byId(oView.getId(), oField.id);
            if (oInput) {
               oInput.attachBrowserEvent("focusout", function () {
                  this._validateNewInvoice(false, [oField.field], true);
               }, this);
            }
         }, this);
      },

      onInvoiceStatusChange: function (oEvent) {
         this._oParentView.getModel("newInvoice")
            .setProperty("/Status", oEvent.getSource().getSelectedKey());
         this._validateNewInvoice();
      },

      _validateNewInvoice: function (bShowErrors, aChangedFields, bMarkChangedFieldsTouched) {
         var oModel = this._oParentView.getModel("newInvoice");
         if (bShowErrors) {
            oModel.setProperty("/validationAttempted", true);
         }
         if (bMarkChangedFieldsTouched) {
            (aChangedFields || []).forEach(function (sField) {
               oModel.setProperty("/touchedFields/" + sField, true);
            });
         }
         var bProductNameValid = oModel.getProperty("/creatingProduct")
            ? Boolean(String(oModel.getProperty("/ProductName") || "").trim())
            : Boolean(oModel.getProperty("/selectedProduct"));
         var bSupplierNameValid = oModel.getProperty("/creatingSupplier")
            ? Boolean(String(oModel.getProperty("/ShipperName") || "").trim())
            : Boolean(oModel.getProperty("/selectedSupplier"));
         var iQuantity = Number(oModel.getProperty("/Quantity"));
         var bQuantityValid = Number.isInteger(iQuantity) && iQuantity > 0;
         var fUnitPrice = Number(oModel.getProperty("/UnitPrice"));
         var bUnitPriceValid = Number.isFinite(fUnitPrice) && fUnitPrice > 0;
         var bProductValid = Boolean(bProductNameValid && bQuantityValid && bUnitPriceValid);
         var bSupplierValid = Boolean(bSupplierNameValid);
         var aStatusKeys = ["A", "B", "C"];
         var sStatus = oModel.getProperty("/Status");
         var sStatusKey = aStatusKeys.indexOf(sStatus) >= 0 ? sStatus : "A";
         var sStatusTextKey = sStatusKey === "A" ? "statusNew"
            : sStatusKey === "B" ? "statusInProgress" : "statusDone";
         var bValidationAttempted = oModel.getProperty("/validationAttempted");
         var oTouchedFields = oModel.getProperty("/touchedFields") || {};
         var oFieldValidation = {
            ProductName: {
               valid: bProductNameValid,
               message: this._getText("validationProductRequired")
            },
            Quantity: {
               valid: bQuantityValid,
               message: this._getText("validationQuantityPositiveInteger")
            },
            UnitPrice: {
               valid: bUnitPriceValid,
               message: this._getText("validationPricePositive")
            },
            ShipperName: {
               valid: bSupplierNameValid,
               message: this._getText("validationSupplierRequired")
            }
         };
         var aFieldsToValidate = bShowErrors
            ? Object.keys(oFieldValidation)
            : aChangedFields || [];
         aFieldsToValidate.forEach(function (sField) {
            var oValidation = oFieldValidation[sField];
            if (oValidation && (bValidationAttempted || oTouchedFields[sField])) {
               oModel.setProperty("/" + sField + "State",
                  oValidation.valid ? "None" : "Error");
               oModel.setProperty("/" + sField + "StateText",
                  oValidation.valid ? "" : oValidation.message);
            }
         });

         oModel.setProperty("/productStepValid", bProductValid);
         oModel.setProperty("/supplierStepValid", bSupplierValid);
         oModel.setProperty("/productValidationMessage",
            this._getProductValidationSummary(oFieldValidation, oTouchedFields, bValidationAttempted));
         oModel.setProperty("/supplierValidationMessage",
            (bValidationAttempted || oTouchedFields.ShipperName) && !bSupplierNameValid
               ? oFieldValidation.ShipperName.message
               : "");
         oModel.setProperty("/statusText", this._getText(sStatusTextKey));
         var sCurrency = (this._oParentView.getModel("view") && this._oParentView.getModel("view").getProperty("/currency")) || "EUR";
         oModel.setProperty("/total", bProductValid
            ? (iQuantity * fUnitPrice).toFixed(2) + " " + sCurrency
            : "");
      },

      _getProductValidationSummary: function (oFieldValidation, oTouchedFields, bShowAllErrors) {
         return ["ProductName", "Quantity", "UnitPrice"].reduce(function (sSummary, sField) {
            var oValidation = oFieldValidation[sField];
            return oValidation.valid || (!bShowAllErrors && !oTouchedFields[sField])
               ? sSummary
               : sSummary + (sSummary ? "\n" : "") + oValidation.message;
         }, "");
      },

      onSaveInvoice: function () {
         var oNewInvoice = this._oParentView.getModel("newInvoice").getData();
         this._validateNewInvoice(true);
         var sProductName = String(oNewInvoice.ProductName || "").trim();
         var sSupplierName = String(oNewInvoice.ShipperName || "").trim();
         var iQuantity = Number(oNewInvoice.Quantity);
         var fUnitPrice = Number(oNewInvoice.UnitPrice);

         if (!oNewInvoice.productStepValid || !oNewInvoice.supplierStepValid) {
            var aValidationMessages = [];
            if (oNewInvoice.ProductNameState === "Error") {
               aValidationMessages.push(oNewInvoice.ProductNameStateText);
            }
            if (oNewInvoice.QuantityState === "Error") {
               aValidationMessages.push(oNewInvoice.QuantityStateText);
            }
            if (oNewInvoice.UnitPriceState === "Error") {
               aValidationMessages.push(oNewInvoice.UnitPriceStateText);
            }
            if (oNewInvoice.ShipperNameState === "Error") {
               aValidationMessages.push(oNewInvoice.ShipperNameStateText);
            }
            var sSummary = this._getText("invoiceValidationSummary") + "\n" + aValidationMessages.join("\n");
            
            // Add messages to MessageManager
            try {
               var oMessageManager = sap.ui.getCore().getMessageManager();
               aValidationMessages.forEach(function (sMsg) {
                  oMessageManager.addMessages(new Message({
                     message: sMsg,
                     type: MessageType.Error,
                     processor: null
                  }));
               });
            } catch (e) {
               // ignore
            }

            MessageBox.error(sSummary);
            return;
         }

         var oInvoice = {
            ProductName: sProductName,
            Quantity: iQuantity,
            ExtendedPrice: iQuantity * fUnitPrice,
            ShipperName: sSupplierName,
            ShippedDate: new Date().toISOString().slice(0, 19),
            Status: oNewInvoice.Status || "A"
         };

         // Busy indicator
         var oDialog = Fragment.byId(this._oParentView.getId(), "createInvoiceDialog");
         if (oDialog) {
            oDialog.setBusy(true);
         }

         invoiceService.createInvoice(oInvoice).then(function (oCreatedInvoice) {
            var oInvoiceModel = this._oParentView.getModel("invoice");
            if (oInvoiceModel) {
               var aInvoices = oInvoiceModel.getProperty("/Invoices") || [];
               oInvoiceModel.setProperty("/Invoices", aInvoices.concat([oCreatedInvoice]));
            }

            // Also refresh OData model if present
            var oODataModel = this._oParentView.getModel();
            if (oODataModel && oODataModel.refresh) {
               oODataModel.refresh(true);
            }

            if (this._fnOnCreated) {
               this._fnOnCreated(oCreatedInvoice);
            }

            if (oDialog) {
               oDialog.close();
            }
            MessageToast.show(this._getText("msgInvoiceSaved", [sProductName]));
         }.bind(this)).catch(function (oError) {
            MessageBox.error(this._getText("productSaveFailed") + "\n" + oError.message);
         }.bind(this)).finally(function () {
            if (oDialog) {
               oDialog.setBusy(false);
            }
         });
      },

      onCancelDialog: function () {
         if (this._pDialog) {
            this._pDialog.then(function (oDialog) {
               oDialog.close();
            });
         }
         MessageToast.show(this._getText("msgSaveCancelled"));
      },

      _getFoodCatalog: function () {
         var oInvoiceModel = this._oParentView.getModel("invoice");
         var aInvoices = (oInvoiceModel && oInvoiceModel.getProperty("/Invoices")) || [];
         var aProducts = [];
         var aSuppliers = [];
         var oProductNames = Object.create(null);
         var oSupplierNames = Object.create(null);

         aInvoices.forEach(function (oInvoice) {
            var sProductName = String(oInvoice.ProductName || "").trim();
            var sProductKey = sProductName.toLocaleLowerCase();
            var iQuantity = Number(oInvoice.Quantity) || 0;
            if (sProductName && !oProductNames[sProductKey]) {
               aProducts.push({
                  ID: sProductName,
                  Name: sProductName,
                  UnitPrice: iQuantity > 0 ? Number(oInvoice.ExtendedPrice) / iQuantity : 0
               });
               oProductNames[sProductKey] = true;
            }

            var sSupplierName = String(oInvoice.ShipperName || "").trim();
            var sSupplierKey = sSupplierName.toLocaleLowerCase();
            if (sSupplierName && !oSupplierNames[sSupplierKey]) {
               aSuppliers.push({ ID: sSupplierName, Name: sSupplierName });
               oSupplierNames[sSupplierKey] = true;
            }
         });

         return { products: aProducts, suppliers: aSuppliers };
      },

      _getText: function (sKey, aArgs) {
         return this._oParentView.getModel("i18n").getResourceBundle().getText(sKey, aArgs);
      }
   });
});
