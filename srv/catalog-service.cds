using invoices.list as db from '../db/schema';

@cds.server.body_parser.limit: '8mb'
service CatalogService {
   entity Invoices as projection on db.Invoices;
}

annotate CatalogService.Invoices with {
   ProductName   @title: 'Product';
   Quantity      @title: 'Quantity';
   ExtendedPrice @title: 'Price';
   ShipperName   @title: 'Supplier';
   ShippedDate   @title: 'Shipped Date';
   Status        @title: 'Status';
};

annotate CatalogService.Invoices with @(
   UI.LineItem: [
      { Value: ProductName, Label: 'Product' },
      { Value: Quantity, Label: 'Quantity' },
      { Value: Status, Label: 'Status' },
      { Value: ShipperName, Label: 'Supplier' },
      { Value: ExtendedPrice, Label: 'Price' },
      { Value: ShippedDate, Label: 'Shipped Date' }
   ],
   UI.SelectionFields: [
      ProductName,
      ShipperName,
      Status
   ]
);