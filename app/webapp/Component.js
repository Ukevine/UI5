sap.ui.define([
   "sap/ui/core/UIComponent",
   "sap/ui/model/json/JSONModel",
   "sap/ui/Device",
   "sap/m/MessageBox",
   "sap/ui/webapp/wt/model/invoiceService"
], function (UIComponent, JSONModel, Device, MessageBox, invoiceService) {
   "use strict";

   return UIComponent.extend("sap.ui.webapp.wt.Component", {

      metadata: {
         manifest: "json"
      },

      init: function () {
         UIComponent.prototype.init.apply(this, arguments);

         var oData = {
            recipient: {
            }
         };
         var oModel = new JSONModel(oData);
         this.setModel(oModel,"recipient");

         // Set the ratings model 
         this.setModel(new JSONModel({}), "ratings");
         this.setModel(new JSONModel({
            layout: "OneColumn"
         }), "layout");

         // Set the device model
         var oDeviceModel = new JSONModel(Device);
         oDeviceModel.setDefaultBindingMode("OneWay");
         this.setModel(oDeviceModel, "device");

         // Register MessageManager model for central validation and backend messages
         var oMessageManager = sap.ui.getCore().getMessageManager();
         this.setModel(oMessageManager.getMessageModel(), "message");

         var oInvoiceModel = new JSONModel({ Invoices: [] });
         this.setModel(oInvoiceModel, "invoice");
         invoiceService.readInvoices().then(function (aInvoices) {
            oInvoiceModel.setData({ Invoices: aInvoices });
         }).catch(function (oError) {
            console.error("Could not load invoices from the CAP service.", oError);
            MessageBox.error("Could not load invoices from the CAP service: " + oError.message);
         });

         var oRouter = this.getRouter();
         var oLayoutModel = this.getModel("layout");
         oRouter.getRoute("overview").attachPatternMatched(function () {
            oLayoutModel.setProperty("/layout", "OneColumn");
         });
         ["detail", "edit"].forEach(function (sRouteName) {
            oRouter.getRoute(sRouteName).attachPatternMatched(function () {
               oLayoutModel.setProperty("/layout", "TwoColumnsBeginExpanded");
            });
         });
         oRouter.initialize();
      },
      getContentDensityClass: function () {
         if (!this._sContentDensityClass) {
            if (!Device.support.touch) {
               this._sContentDensityClass = "sapUiSizeCompact";
            } else {
               this._sContentDensityClass = "sapUiSizeCozy";
            }
         }
         return this._sContentDensityClass;
      },
      toggleTheme: function () {
         var sCurrentTheme = sap.ui.getCore().getConfiguration().getTheme();
         var sNewTheme = sCurrentTheme === "sap_horizon_dark" ? "sap_horizon" : "sap_horizon_dark";
         sap.ui.getCore().applyTheme(sNewTheme);
         return sNewTheme;
      }
   });
});