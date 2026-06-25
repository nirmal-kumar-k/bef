const fs = require('fs');
const docx = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle } = docx;

const doc = new Document({
    sections: [{
        properties: {},
        children: [
            new Paragraph({
                text: "FOUNDRY MANAGEMENT SYSTEM",
                heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
                text: "Project Scope Document",
                heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({ text: " " }),
            new Paragraph({ text: "1. Project Overview", heading: HeadingLevel.HEADING_3 }),
            new Paragraph({ text: "1.1 System Description", heading: HeadingLevel.HEADING_4 }),
            new Paragraph({ text: "The Foundry Management System is a web and mobile application that enables a foundry organisation to manage its pattern master data, product specifications, order lifecycle, customer interactions, and management reporting from a single integrated platform." }),
            new Paragraph({ text: " " }),
            
            new Paragraph({ text: "2. Scope of Work", heading: HeadingLevel.HEADING_3 }),
            new Paragraph({ text: "2.1 In-Scope Modules", heading: HeadingLevel.HEADING_4 }),
            new Paragraph({ text: "Added: 9. Production Scheduling - Allow admins to assign received/in-progress orders to specific dates across Moulding, Melting, and Fettling process stages via a visual calendar." }),
            new Paragraph({ text: " " }),
            
            new Paragraph({ text: "4. Key Functional Use Cases", heading: HeadingLevel.HEADING_3 }),
            new Paragraph({ text: "Added: 13. Schedule Production - Admin schedules orders across Moulding, Melting, and Fettling stages via a calendar interface." }),
            new Paragraph({ text: " " }),
            
            new Paragraph({ text: "5. Out of Scope", heading: HeadingLevel.HEADING_3 }),
            new Paragraph({ text: "REMOVED: Melting & Pouring Process Tracking AND Fettling & Finishing Operations. These are now IN-SCOPE via the Production Scheduling module." }),
            new Paragraph({ text: " " }),
            
            new Paragraph({ text: "6. Assumptions & Constraints", heading: HeadingLevel.HEADING_3 }),
            new Paragraph({ text: "REMOVED CONSTRAINT: All interfaces and data displays must use only black and white colour schemes with no colour highlighting." }),
            new Paragraph({ text: "REMOVED CONSTRAINT: Production floor process stages (melting, pouring, fettling) are deferred and must not influence the data model of the current release." }),
            new Paragraph({ text: "These constraints have been voided by the recent UI redesign and the addition of the Production Schedule module." }),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("d:\\BEF\\Project_Scope_Updated.docx", buffer);
    console.log("Created Project_Scope_Updated.docx");
});
