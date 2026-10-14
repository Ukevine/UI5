namespace invoices.list;

entity Invoices {
   key ID          : UUID;
       ProductName : String(40);
       Quantity    : Integer;
       ExtendedPrice : Decimal(19, 4);
       ShipperName : String(40);
       ShippedDate : DateTime;
       Status      : String(1);
       ProductImage : LargeBinary;
       ProductImageType : String(100);
       PdfDocument : LargeBinary;
       PdfDocumentType : String(100);
       PdfDocumentName : String(255);
}