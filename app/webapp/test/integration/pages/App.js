sap.ui.define([
   "sap/ui/test/Opa5",
   "sap/ui/test/actions/Press"
], function (Opa5, Press) {
   "use strict";

   Opa5.createPageObjects({
      onTheAppPage: {
         actions: {
            iPressCreateInvoiceButton: function () {
               return this.waitFor({
                  id: "btnNewInvoice",
                  viewName: "sap.ui.webapp.wt.view.InvoiceList",
                  actions: new Press(),
                  errorMessage: "Did not find the Create button in InvoiceList view"
               });
            }
         },

         assertions: {
            iShouldSeeTheTable: function () {
               return this.waitFor({
                  id: "invoiceList",
                  viewName: "sap.ui.webapp.wt.view.InvoiceList",
                  success: function () {
                     Opa5.assert.ok(true, "The invoice list table is visible");
                  },
                  errorMessage: "Did not find the invoice table"
               });
            },
            iShouldSeeTheCreateDialog: function () {
               return this.waitFor({
                  controlType: "sap.m.Dialog",
                  success: function () {
                     Opa5.assert.ok(true, "The create invoice dialog is open");
                  },
                  errorMessage: "Did not find the create invoice dialog"
               });
            }
         }
      }
   });
});