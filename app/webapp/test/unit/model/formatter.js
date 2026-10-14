sap.ui.define([
   "sap/ui/webapp/wt/model/formatter",
   "sap/ui/model/resource/ResourceModel",
   "sap/ui/thirdparty/sinon",
   "sap/ui/thirdparty/sinon-qunit"
], function (formatter, ResourceModel) {
   "use strict";
// This file is loaded by test/unit/unitTests.qunit.html
   QUnit.module("Formatting functions", {
      beforeEach: function () {
         this._oResourceModel = new ResourceModel({
            bundleUrl: sap.ui.require.toUrl("sap/ui/webapp/wt/i18n/i18n.properties")
         });
      },
      afterEach: function () {
         this._oResourceModel.destroy();
      }
   });

   QUnit.test("Should return the translated texts", function (assert) {
      // Arrange
      var oViewStub = {
         getModel: this.stub().withArgs("i18n").returns(this._oResourceModel)
      };
      var oControllerStub = {
         getView: this.stub().returns(oViewStub)
      };

      // System under test
      var fnIsolatedFormatter = formatter.statusText.bind(oControllerStub);

      // Assert
      assert.strictEqual(fnIsolatedFormatter("A"), "New", "The long text for status A is correct");
      assert.strictEqual(fnIsolatedFormatter("B"), "In Progress", "The long text for status B is correct");
      assert.strictEqual(fnIsolatedFormatter("C"), "Done", "The long text for status C is correct");
      assert.strictEqual(fnIsolatedFormatter("Foo"), "Foo", "The long text for status Foo is correct");
   });

   QUnit.test("Should return the initials for a given product name", function (assert) {
      assert.strictEqual(formatter.initials("Pineapple"), "PI", "The initials for Pineapple are correct");
      assert.strictEqual(formatter.initials("Milk"), "MI", "The initials for Milk are correct");
      assert.strictEqual(formatter.initials(""), "", "Empty string produces empty initials");
   });
});