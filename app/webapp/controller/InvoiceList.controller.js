sap.ui.define([
   "sap/ui/core/mvc/Controller",
   "sap/ui/model/json/JSONModel",
   "sap/ui/webapp/wt/model/formatter",
   "sap/ui/model/Filter",
   "sap/ui/model/FilterOperator",
   "sap/ui/model/Sorter",
   "sap/m/MessageToast",
   "sap/ui/core/Fragment",
   "sap/m/MessageBox",
   "sap/ui/core/MessageType",
   "sap/ui/webapp/wt/model/invoiceService",
   "sap/ui/webapp/wt/controller/CreateInvoiceDialog"
], function (Controller, JSONModel, formatter, Filter, FilterOperator, Sorter, MessageToast, Fragment, MessageBox, MessageType, invoiceService, CreateInvoiceDialog) {
   "use strict";

   return Controller.extend("sap.ui.webapp.wt.controller.InvoiceList", {
      formatter: formatter,

      onInit: function () {
         var oViewModel = new JSONModel({
            currency: "EUR",
            itemCount: 0,
            selectedCount: 0,
            busy: false,
            messageCount: 0,
            errorCount: 0
         });
         this.getView().setModel(oViewModel, "view");

         // Modular Create Invoice Dialog handler
         this._oCreateDialog = new CreateInvoiceDialog(this.getView());

         // Track MessageManager state for the MessagePopover badge
         var oMessageModel = sap.ui.getCore().getMessageManager().getMessageModel();
         oMessageModel.bindList("/").attachChange(this._updateMessageStats, this);
         this._updateMessageStats();
      },

      _updateMessageStats: function () {
         var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData() || [];
         var iErrors = aMessages.filter(function (oMsg) {
            return oMsg.type === MessageType.Error;
         }).length;
         var oViewModel = this.getView().getModel("view");
         if (!oViewModel) {
            return;
         }
         if (oViewModel.getProperty("/messageCount") !== aMessages.length) {
            oViewModel.setProperty("/messageCount", aMessages.length);
         }
      },

      onPress: function (oEvent) {
         var oItem = oEvent.getSource();
         this._navigateToInvoice(oItem, "detail");
      },

      _navigateToInvoice: function (oItem, sRoute) {
         var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
         var oBindingContext = oItem.getBindingContext("invoice") || oItem.getBindingContext();
         if (!oBindingContext) {
            return;
         }
         var oInvoice = oBindingContext.getObject();
         oRouter.navTo(sRoute, {
            invoiceId: encodeURIComponent(oInvoice.ID)
         });
      },

      onSelectionChange: function () {
         var oTable = this.byId("invoiceList");
         var iSelected = oTable ? oTable.getSelectedItems().length : 0;
         this.getView().getModel("view").setProperty("/selectedCount", iSelected);
      },

      onEditSelected: function () {
         var oTable = this.byId("invoiceList");
         var aSelected = oTable ? oTable.getSelectedItems() : [];
         if (aSelected.length === 1) {
            this._navigateToInvoice(aSelected[0], "edit");
         }
      },

      onDeleteSelected: function () {
         var oTable = this.byId("invoiceList");
         var aSelected = oTable ? oTable.getSelectedItems() : [];
         var aInvoices = aSelected.map(function (oItem) {
            var oContext = oItem.getBindingContext("invoice") || oItem.getBindingContext();
            return oContext ? oContext.getObject() : null;
         }).filter(Boolean);

         if (!aInvoices.length) {
            return;
         }

         var sConfirmMsg = this._getText("confirmInvoiceDelete", [aInvoices.length]);
         MessageBox.confirm(sConfirmMsg, {
            onClose: function (sAction) {
               if (sAction === MessageBox.Action.OK) {
                  this._deleteInvoices(aInvoices);
               }
            }.bind(this)
         });
      },

      _deleteInvoices: function (aInvoices) {
         var oViewModel = this.getView().getModel("view");
         oViewModel.setProperty("/busy", true);

         var aDeletes = aInvoices.map(function (oInvoice) {
            return { invoice: oInvoice, succeeded: false, error: null };
         });

         Promise.all(aDeletes.map(function (oDelete) {
            return invoiceService.deleteInvoice(oDelete.invoice.ID).then(function () {
               oDelete.succeeded = true;
            }).catch(function (oError) {
               oDelete.error = oError;
            });
         })).then(function () {
            var oInvoiceModel = this.getOwnerComponent().getModel("invoice");
            if (oInvoiceModel) {
               var aCurrent = oInvoiceModel.getProperty("/Invoices") || [];
               oInvoiceModel.setProperty("/Invoices", aCurrent.filter(function (oItem) {
                  return !aDeletes.some(function (oDelete) {
                     return oDelete.succeeded && oDelete.invoice.ID === oItem.ID;
                  });
               }));
            }

            var oTable = this.byId("invoiceList");
            if (oTable) {
               oTable.removeSelections(true);
            }
            oViewModel.setProperty("/selectedCount", 0);

            // Refresh OData model if present
            var oODataModel = this.getView().getModel();
            if (oODataModel && oODataModel.refresh) {
               oODataModel.refresh(true);
            }

            var iDeleted = aDeletes.filter(function (oD) { return oD.succeeded; }).length;
            var aErrors = aDeletes.filter(function (oD) { return oD.error; });

            if (aErrors.length) {
               MessageBox.error(this._getText("invoiceBulkDeleteFailed") + "\n" +
                  aErrors.map(function (oD) { return oD.error.message; }).join("\n"));
            }
            if (iDeleted) {
               MessageToast.show(this._getText("invoicesDeleted", [iDeleted]));
            }
         }.bind(this)).finally(function () {
            oViewModel.setProperty("/busy", false);
         });
      },

      onCreate: function () {
         this._oCreateDialog.open(function () {
            this.onRefresh();
         }.bind(this));
      },

      onRefresh: function () {
         var oViewModel = this.getView().getModel("view");
         oViewModel.setProperty("/busy", true);

         var oInvoiceModel = this.getOwnerComponent().getModel("invoice");
         invoiceService.readInvoices().then(function (aInvoices) {
            if (oInvoiceModel) {
               oInvoiceModel.setData({ Invoices: aInvoices });
            }
            var oODataModel = this.getView().getModel();
            if (oODataModel && oODataModel.refresh) {
               oODataModel.refresh(true);
            }
            MessageToast.show(this._getText("refreshComplete"));
         }.bind(this)).catch(function (oError) {
            MessageBox.error(oError.message);
         }).finally(function () {
            oViewModel.setProperty("/busy", false);
         });
      },

      onSmartFilterSearch: function () {
         var oSmartFilter = this.byId("smartFilterBar");
         var oTable = this.byId("invoiceList");
         if (!oSmartFilter || !oTable) {
            return;
         }
         if(!oSmartFilter.isInitialised()) {
            return;
         }

         var aFilters = oSmartFilter.getFilters();
         var oBinding = oTable.getBinding("items");
         if (oBinding) {
            oBinding.filter(aFilters, "Application");
         }
      },

      onBeforeRebindTable: function (oEvent) {
         var mBindingParams = oEvent.getParameter("bindingParams");
         if (mBindingParams) {
            // Keep the JSON `invoice>/Invoices` binding. SmartTable would
            // otherwise rebind to OData and rebuild the table on every search.
            mBindingParams.preventTableBind = true;
         }
      },

      onUpdateFinished: function (oEvent) {
         var oBinding = oEvent.getSource().getBinding("items");
         var iCount = oBinding ? oBinding.getLength() : 0;
         this.getView().getModel("view").setProperty("/itemCount", iCount);
      },

      onToggleTheme: function () {
         var sNewTheme = this.getOwnerComponent().toggleTheme();
         MessageToast.show(this._getText("themeChanged", [sNewTheme]));
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

      _getText: function (sKey, aArgs) {
         return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
      }
   });
});