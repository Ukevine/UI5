sap.ui.define([
   "sap/ui/test/opaQunit",
   "./pages/App"
], function (opaTest) {
   "use strict";

   QUnit.module("Navigation");

   opaTest("Should see the invoice table and open create dialog", function (Given, When, Then) {
      // Arrangements
      Given.iStartMyAppInAFrame("../../index.html");

      // Assertions
      Then.onTheAppPage.iShouldSeeTheTable();

      // Actions
      When.onTheAppPage.iPressCreateInvoiceButton();

      // Assertions
      Then.onTheAppPage.iShouldSeeTheCreateDialog();

      // Cleanup
      Then.iTeardownMyAppFrame();
   });
});