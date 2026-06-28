
title: remit overview
1)Remit Files Delivery:
Majority of our clients utilize our dedicated SFTP server at data.purchasingpwr.com, where they establish connections and securely transfer their remit files. This centralized approach ensures consistent file receipt and streamlined processing.

However, for certain clients, we adapt to their infrastructure and connect directly to their SFTP environments, retrieving eligibility files placed on their servers. This dual-mode capability allows us to accommodate diverse client needs while maintaining reliable and efficient data exchange. 

2)Moveit File Transfer:

Once the Remit file is ready, Moveit automation rules encrypt the file, apply the required naming conventions, transfer it to the Pentaho server and archive the file for record-keeping.

3)Pentaho Remit Job processing:
The Pentaho Remit job jb_master_Job_Remit_A_Z is scheduled to run every 15 minutes,
though it runs every 15 min the files are processed only during below window:


Day: Only weekdays (Monday–Friday).

Time: Business hours (8 AM to 5 PM EST).

 4)Remit Stage load:
When a file is available during above mentioned timeframe, the job retrieves and decrypts it, then invokes the client-specific processing logic. This flexibility is necessary because each client's Remit file may differ in layout, file format, and presence or structure of headers.
Note: Clients that belongs to a TPA will be mapped to same stage1 reader since they are 
all have same file format.

Why dynamic routing?
As per our design, each client has a dedicated reader transform for processing remit files. These reader transforms are tailored to handle client-specific file structures, business rules, and processing logic.

To identify the correct reader for a given client:

The system queries the ETL_MFT.REMIT_ETL_CONFIG table using clientcd, filepart, and hostid values extracted from the filename.

Based on this lookup, the workflow dynamically determines which reader transform should process the file.

The client specific transform reads data from the client remit file and loads into Remit_Stage_1

Source path
file:///var/cache/pentaho/remit/serialize

Decryption path
/var/cache/pentaho/remit/Decrypt

Decrypted files path
/var/cache/pentaho/remit/Ready

File Execution path
/var/cache/pentaho/srcfiles/remit/workzone.

       5)Apply Data Standardization/Validation

Amount Data type validation - Any string data in amount field aborts job, stops file from further processing and ticket created for further analysis and fix

Zero records validation - if the remit file doesn't have any valid remit record to process then job is aborted, file is stopped from further processing and ticket created for further analysis and fix

Zero amount validation - Sum of amount of all the remit records in the file is 0 then 
job is aborted, file is stopped from further processing and ticket created for further analysis and fix

Data standardization for amount, first name, last name, and customer ID - remove any unwanted spaces, currency symbols, plus/minus signs, parentheses, commas from those strings. 

Paydate date format validation yyyymmdd
Custid length validation 
null paydate is replaced with system date
firstname, lastname, customerid - converted to uppercase 
Left/right 0 padding for custid (if eligibility custid is 00012345 and custid in remit is 12345 then remitcustomerconfiguration table is configured to left pad 3 0’s)

Data is loaded to remit stage 2 table.
Data that didnt qualify the validations will be sent to remit_review_table

 

         6)Validation against Oracle EBS/NLS: 

        After Remit Stage 2, the data will be loaded into the Remit Stage table by
        performing below validations.

The first step is to load the pay calendar from the XXPMT_CALENDAR table, which resides in the Oracle EBS database. Then, we extract the data from the REMIT_STAGE_2 table for the current batch ID.

Employment status by default is fetched from Eligibility data but in certain cases it fetched from Remit file as per request from Client, in such cases host config table is flagged and for such client employment status value is fetched from remit file.
Such records qualify for employee status validation through Remit_Lkp_Employeestatus table. If no record exists for the current client or if that column is null, we flag those records with the error reason “Missing Employee Status” and mark them as bad records.

We then use the etl_nls_utils.isinnls function to verify whether the CUSTID from remit file exists for the specific customer in NLS.  If not found, we send these records to remit_review_table with the error message “CASH APPID NOT IN NLS.” and the file is stopped from further processing.

If CUSTID from remit file is not present in Oracle ebs then the records are rejected to remit review table as “CASH APPID NOT FOUND.”  and the file is stopped from further processing.

If CUSTID from remit file has more than one match in Oracle ebs then the records are rejected to remit review table as “MULTIPLE CASHAPP ID.”  and the file is stopped from further processing.

All these validations are performed sequentially, meaning a record can fail multiple validations. In such cases, we concatenate the error messages so that the final error message contains all reasons for which the record failed.

All bad records are loaded into the REMIT_REVIEW_TABLE along with their corresponding error messages. A Jira ticket is created, and an email notification is sent with details of the number of records that failed for each validation.

Records that pass all validations are successfully loaded into the REMIT_STAGE table.

 

     7)Remit file generation
Clients are configured as ACCOUNT or CONTRACT in REMIT_ETL_CONFIG table(default ACCOUNT)
Account - customer level processing (If a customer has more than one order, all the orders amount is combined in as one record at customer level
Contract - order level processing (If a customer has more than one order, then there is one record per order since its at order level)

Previously processed paydate validation: If we have already processed a file for same paydate as current file then this file is aborted from further processing and an entry is added in REMIT_PREVIOUS_PROCESSED. An Apex screen is developed to point to this table and Finops team action these files using the reprocess flag, anything submitted as reprocess - Y is automatically picked for reprocessing by another remit automated flow.

Remit file is created with required filena name format and is placed in fileshare for oracle ebs, we also invoke an oracle procedure after which oracle ebs team picks the remit file for processing.

Example filename:
 //opt/outbound/remit/2711_NLS_REMITTANCE_20250929181901.csv  .  


Data loaded to file is also loaded to Remit table.

File level data is loaded to Remit_app_status table and the status column shows the status of the file.

jb_master_remit_get_cashapps_results is scheduled to run independently every 15min which fetches the file status from oracle ebs system and updates in remit_app_status

Final status should be 'IN NLS' which means the file has been successfully loaded to NLS.

title:Deduction File Creation Overview

Deduction files are outbound files sent to clients. They contain customer information, deduction amounts, pay dates, and more. These files are crucial and must be sent on time to ensure timely paycheck deductions

image-20251105-095416.png
Key Highlights - 

Sequential Workflow: The process begins with the Deduction job and flows through request validation, configuration loading, file generation, and status updates, ensuring a structured and traceable pipeline.

Database Interactions: Critical tables like XXDED_DEDUCT_PROCESS_REQUEST, XXDED_DEDUCT_FILE_CFG_MASTER, and XXDED_DEDUCT_FILE_CFG_DETAIL are used to fetch request metadata and client-specific configurations.

Dynamic File Creation: The Prod_Config and Prod_File_Creation transformations dynamically build SQL and generate deduction files in multiple formats (XML, Excel, Delimited, Fixed Length), tailored per client.

Failure Handling: If any step fails—especially during file creation—the process routes to Process_Status_Failure.xml to log the error, update the request status to FAILED, and notify the FinOps Manager.

Test Mode Branching: If the TEST_PROD flag is set, the workflow branches into a test path that includes generating redacted and unredacted test files for validation.

ETL Deduction Jobs and transformations - 

1. Deduction (Main Job) 
Purpose: Entry point for the entire deduction file creation process.
Actions:

Triggers sub jobs and transformations in sequence.

Determines execution mode (Test or Prod).

Manages logging and error handling.

Sets up the orchestration logic for the full pipeline.

2. Ready and Regenerate (Ready_Regenerate_Req_Loop)
Purpose: Identifies requests in READY or REGENERATE status and initiates processing.
Detailed Actions:

Queries XXDED_DEDUCT_PROCESS_REQUEST for eligible requests.

Ensures only one instance of the main job is running using log_job.

Sets PROCESS_STATUS to INPROGRESS and logs PROCESS_START_TIME.

Initializes control flags and JVM variables.

Key Tables:

XXDED_DEDUCT_PROCESS_REQUEST

Failure Handling:

Aborts if no valid request or duplicate job is detected.

Logs error in LOG_FIELD.

3. Subjob
Purpose: Routes the flow to either Ready or Regenerate based on request status.
Actions:

Reads request metadata.

Determines if regeneration is needed.

Triggers appropriate sub job.

Implements abort logic if request is invalid.

Failure Handling:

Aborts if request status is not recognized or missing.

4. Deduction File Creation (Main Transformation)
Purpose: Core transformation that generates the deduction file.
Actions:

Executes SQL queries to fetch deduction data.

Applies formatting rules based on configuration.

Constructs header, body, and footer.

Writes output file to designated location.

Key Tables:

XXDED_DEDUCT_ACCOUNT_DATA

XXDED_DEDUCT_CONTRACT_DATA

Failure Handling:

Logs errors in LOG_FIELD.

Handles empty file logic based on SEND_EMPTY_FILE flag.

5. Set_Request
Purpose: Initializes request-specific metadata.
Actions:

Retrieves REQUEST_ID, O_SNO from XXDED_DEDUCT_PROCESS_REQUEST.

Sets JVM variables for downstream use.

Failure Handling:

Aborts if request metadata is missing or invalid.

6. Check_Request
Purpose: Validates the incoming request.
Actions:

Confirms request exists and is active.

Joins with XXDED_DEDUCT_FILE_CFG_MASTER to fetch configuration.

Sets flags for header/footer, file format, and other parameters.

Failure Handling:

Aborts if request is not found or configuration is missing.

7. Configuration Table
Purpose: Loads system-level configuration.
Actions:

Reads TEST_PROD flag.

Sets batchid, MAIN_REQUEST_ID, and other identifiers.

Prepares environment variables.

Failure Handling:

Aborts if configuration is missing or invalid.

8. Prod_Config
Purpose: Loads production-specific configuration.
Actions:

Reads metadata from master/detail config tables.

Builds dynamic SQL for header, body, footer.

Applies quoting, padding, delimiter, and formatting logic.

Sets JVM variables for file creation.

Key Tables:

XXDED_DEDUCT_FILE_CFG_MASTER

XXDED_DEDUCT_FILE_CFG_DETAIL

Failure Handling:

Aborts if required configuration is missing.

Logs error in LOG_FIELD.

9. Prod_File_Creation
Purpose: Generates the final production deduction file.
Actions:

Executes dynamic SQL to fetch data.

Constructs header, body, footer based on configuration.

Supports XML, Excel, Delimited, Fixed Length formats.

Handles empty file logic and file splitting.

Failure Handling:

Logs errors and aborts on SQL or file write failures.

Creates empty file if SEND_EMPTY_FILE = Y.

10. Update_Request
Purpose: Updates request status after processing.
Actions:

Updates XXDED_DEDUCT_PROCESS_REQUEST with final status (COMPLETED, FAILED, REGENERATED).

Logs timestamps and metrics.

Failure Handling:

Logs error if update fails.

11. Marsh
Purpose: Marsh data into structured formats.
Actions:

Converts internal data into XML/JSON.

May support logging or external integrations.

Failure Handling:

Logs error if transformation fails.

12. Test_ConfigTable
Purpose: Loads configuration for test environment.
Actions:

Similar to Configuration Table.xml but for test mode.

Sets test-specific variables.

Failure Handling:

Aborts if test configuration is missing.

13. Process_Status_Failure
Purpose: Handles failure scenarios.
Actions:

Updates request status to FAILED.

Logs error details.

Sends notifications to FinOps Manager.

Failure Handling:

Ensures failure is logged and communicated.

14. Test_File_Creation
Purpose: Generates test deduction files.
Actions:

Uses test data and configuration.

Constructs header, body, footer.

Validates formatting and structure.

Failure Handling:

Logs errors and aborts on failure.

15. Test_Redacted_file
Purpose: Creates redacted test files.
Actions:

Applies redaction logic to sensitive fields.

Ensures privacy compliance.

Failure Handling:

Logs error if redaction fails.

16. Test_Unredacted_file
Purpose: Creates unredacted test files.
Actions:

Outputs full data for internal validation.

Used for debugging and QA.

Failure Handling:

Logs error if file creation fails.

Deduction File Creation – Summary Table 
Condition / Step

Action Taken

Deduction (Main Job)

Starts the process and triggers subjobs.

Ready & Regenerate

Identifies requests in READY/REGENERATE status and sets them to INPROGRESS.

Subjob

Routes the request to either Ready or Regenerate logic.

Deduction File Creation

Initiates the transformation sequence for file generation.

Set_Request

Initializes request-specific variables like REQUEST_ID and SNO.

Check_Request

Validates the request and loads client configuration.

Configuration Table

Loads system-level config (e.g., TEST_PROD flag, batch ID).

Prod_Config

Builds dynamic SQL and sets formatting rules for the file.

Prod_File_Creation

Generates the deduction file in the required format.

Update_Request

Updates the request status to COMPLETED or FAILED.

Marsh

Converts data into structured formats (e.g., XML/JSON).

Test_ConfigTable

Loads configuration specific to test environments.

Test_File_Creation

Generates test deduction files for QA or client validation.

Any step above fails

Routes to Process_Status_Failure to log error and notify stakeholders.

Process_Status_Failure

Updates request status to FAILED, logs error details, and sends notifications.

What Happens When a Step Fails?
If any of the steps from Set_Request to Test_File_Creation encounters an error (e.g., missing data, SQL failure, config issue), the process immediately routes to Process_Status_Failure. This ensures:

The failure is logged in the system.

The request status is updated to FAILED.

Notifications are sent to the FinOps or support team for resolution.

title:SPI Overview

This page explains on high level overview of how Mirakl - Syndigo PIM are integrated through ETL as part of SPI project(phase-1 and phase-1.1).

-> SPI project for ETL is all about getting product Info to Storefront from Mirakl.
-> This includes Integration of multiple systems starting with Mirakl to EDS to Hybris BO to Store front.

The main Jobs for getting products data from Mirakl to EDS are Job_SPI_Main and Job_SPI_Product_Feed_to_Mirakl


Mirakl URL’s
Mirakl URLs and their corresponding Tokens are used from Kettle.properties file for all jobs and transformations

Env

URL

Mirakl Dev

https://purchasingpowerus-dev.mirakl.net

Mirakl Pre-Prod

https://purchasingpowerus-preprod.mirakl.net

Mirakl Prod

https://purchasingpowerus-prod.mirakl.net

Note: Mirakl URL and Token are configured in Kettle.properties file

Mirakl-EDS :
These are the process involved in getting products/Offers/vendors/POR/Brands/Categories from Mirakl to EDS and vice versa.

Product Creation

Offer Decision Engine

Pricing calculator

Feed to EDS

POR File processing

VI rejects from EDS

Automated brands

Automated categories

Operational reporting

Troubleshooting

Mirakl Health check:
Before calling Mirakl APIs for products/offers/shops/brands/categories ETL will do a health check for Mirakl using V01 API call provided by Mirakl.
If the Mirakl sever is not reachable then all product/offer/shop/brands/ categories jobs will be terminated without processing.
V01 call:

API endpoint

https://purchasingpowerus-dev.mirakl.net/api/version

Method

GET

Response

200

RESULT

{  "version" : "3.1177" }

->If the status is not 200 Get the API response to V01_TRACKING table ERROR_DESC column.
->Then Abort the Job where we got the health check failure.

FLAGs in SPI_PRODUCTS:
 

-> SPI_PRODUCTS table is the Master table to track all Products/Offers from Mirakl to EDS
-> SPI_CURRENT_PRODUCTS_V is the view built on SPI_PRODUCTS table which has the latest record of each product from Mirakl

-> SPI_CURRENT_PRODUCTS_WITH_OFFERS_V is the view built on SPI_CURRENT_PRODUCTS_V to get the only the products if an offer is associated with the product

Columns in SPI_PRODUCTS

FLAG

Value

SETUPTYPE

N

New Product accepted by PPC

R

Revised Product from Mirakl

X

Product is a core product

VI

Product is a Vendor Item rejects

D

Product is associated with multiple UPCs

T

Product is rejected due to Invalid data from Mirakl

ORACLE_STATUS

(null)

yet to be processed by oracle if setuptype='N'

Y

Oracle processed the record

SEND_to_EDS

Y

Data to be shipped to EDS

N

This data will not be sent to EDS

SEND_to_MIRAKL

Y

New Product not yet synced with Mirakl

P

Product is successfully synced with Mirakl

OFFER_PRICE_CHANGE

Y

Change in offer_price from prev value

N

No change in offer price

OFFER_COST_CHANGE

Y

Change in product_cost from prev value

N

No change in product_cost

NEED_PRICE_CALC

Y

Pricing calculator calculates new base_price

N

Product is not qualified for pricing calculator

STOCK_LEVEL_CHANGE

Y

Change in stock value from prev value

N

No change in stock level

VENDOR_CHANGE

Y

Product is assigned with a new offer

N

No change in Offer_id

BIZ_OVERRIDE

Y

Offer is Overridden from UI

N

The offer is picked by ODE

SPI phase1  DOCs:

SPI - ETL Design.vsdx
08 Dec 2025, 04:57 AM

SPI conceptual data model.vsdx
08 Dec 2025, 04:57 AM

SPI DFD.vsdx
08 Dec 2025, 04:57 AM
 

SPI GCC AHM presentation: 
June 2025 - Mirakl Presentation.pptx

1. Product Creation:
Product is a product irrespective of the vendor we get it from. SPI project sources products from Mirakl and the products are to be created and synced in the downstream systems of PPC (ETL/Oracle/EDS/Hybris/EDM/tableau)

 

Product Creation consists of three steps

1.Souring products data form Mirakl [Job_SPI_Products]

2.Processing the Sourced product data [Job_SPI_Product_Processing]

3.Sync product acceptance To Mirakl [Job_SPI_Product_Feed_to_Mirakl]

Once Mirakl operator from PPC accepts a product from Mirakl, the products are now pulled via API calls from Pentaho jobs.

ETL will pull the Products data every 5 minutes via API call to the Product_API end points. (CM52, CM53, CM54)
-> from PULL the products from API with product info as

acceptance_status='ACCEPTED'

validation_status='VALID'

and has changed since the last successful pull (DELTA_TIME)

->If a product is rejected by PPC this should also be synced with Mirakl along with accepted products.

 

1.1. Sourcing products data from Mirakl
      ETL will pull the Products data from Mirakl every 5 minutes using three API calls: 
CM52, CM53 and CM54

 

1.1.1. CM52 Call:

API endpoint

https://purchasingpowerus-dev.mirakl.net/api/mcm/products/export/async

Method

POST

Request

{"acceptance_status":["ACCEPTED"], "validation_status":["VALID"],
"updated_since":"DELTA_TIME"}

Response

200

RESULT

{"tracking_id":"XXXXXXX"}

This Delta_time in Request is based on the previous successful run time.

ETL will get a tracking id from CM52 call which is parsed and stored in CM52_DATA table will be used in CM53 call

-> If the API response from CM52 call is not 200 then the API_ERROR_DESC is tracked through CM52_tracking table, and this gets a Jira ticket created for the failure

-> API response is loaded directly to CM52 table as RESULT

-> This result is parsed and stored in CM52_DATA table which is then used in CM53 API call

1.1.2. CM53 Call:

API endpoint

https://purchasingpowerus-dev.mirakl.net/api/mcm/products/export/async/status/{tracking_id}

Method

GET

Response

200

Sample Result

{

  "last_updated" : "2025-02-05T11:41:41.219Z",

  "status" : "COMPLETED",

  "urls" : [ "https://purchasingpowerus-dev.mirakl.net/api/mcm/products/export/async/file/06ef1433-7f94-4e28-9cfa-f6f3824682cc?file=%2F06ef1433-7f94-4e28-9cfa-f6f3824682cc%2F0.json" ]

}

This URL from CM53 Call is the API end point for CM54 Call.
Note:
a) if the response is not 200 the status='FAILED' 
b) if the response is 200 and status='COMPLETED' then good to proceed for CM54 and if URL is empty with status='COMPLETED' it means no changes are done in products API and we consider export as completed

Eg:  "{"last_updated" : "2025-02-10T14:44:40.931Z","status" : "COMPLETED","urls" : [ ]}"

c) if the status='PENDING' the same tracking id should be called till we get a status as completion
d) if the response=200 and status is not 'PENDING' or 'COMPLETED' then we consider the export is cancelled
 
All the content of CM53 call is parsed and stored in CM53_DATA (URL, Export status).

-> If the API response from CM53 call is not 200 then the API_ERROR_DESC is tracked through CM53_tracking table, and this gets a Jira ticket created for the failure

-> API response is loaded directly to CM53 table as RESULT

-> This result is parsed and stored in CM53_DATA table which is then used in CM54 API call

1.1.3. CM54 Call:

API endpoint: 

URL form CM53 Call

Method

GET

Response

200

-> If the API response from CM54 call is not 200 then the API_ERROR_DESC is tracked through CM54_tracking table, and this gets a Jira ticket created for the failure

-> The result from CM54 call has all products details in a single Json , this data is parsed to a single product Json and loaded to CM54 table .
->The single Product Json data will be parsed and loaded to CM54_data table , if anything fails to load to CM54_data table then the data will be loaded to CM54_data_bad_record table 
-> Product export from Mirakl is completed in CM54_data table    

-> The single Product Json data will be parsed and loaded to CM54_data table, if anything fails to load to CM54_data table then the data will be loaded to CM54_BAD_DATA_RECORD

-> Map multiple attributes from Mirakl into a single column attribute of EDS.

-> Filp Mfgpart number with ParentMfg part number if the product is a variant (EDS expects this)

-> If the load is complete and success update CM54 table status as ‘Y’ for the product

-> If not update CM54 table with as status of ‘P’ along with Error that caused the product to load to CM54_DATA_BAD_record, this product will be rejected back to Mirakl as Invalid data via CM54 table Error Desc column

image-20250807-121957.png
Products API
 

Back Tracking: To track when the product loaded. Back track form CM54_DATA table starting with CM54_SNO (CM54_DATA)->CM53_SNO(CM54) -> CM53_SNO(CM53_DATA)-> CM52_SNO(CM53) → CM52_SNO(CM52_DATA) [this gives the DELTA_Time to reprocess].

Trouble shooting:

select ETL_LOAD_TIME, UPC,MIRAKL_PRODUCT_ID, RECORD_STATUS from ETL_SPI_DATA.CM54_data where UPC= 123456 order by etl_load_time desc;

 Select * from ETL_SPI_DATA.CM54 where Result like '%123456%' order by etl_load_time desc;

->check for ERROR_DESC column of CM54 table to find what went wrong if the product has Invalid Data reject reason in Mirakl UI

Mirakl-ETL-Mapping: Mirakl-ETL-EDS-Mapping.xlsx

1.2. Processing the Sourced product data
From the Product API calls, we have now sourced products content.
Consider Mirakl provides 'N*N' products and the operator from PPC accepted ‘N' products, it doesn’t mean PPC will sell all the products in Store front. As per the design of SPI phase1 ,Products from Mirakl will undergo a UPC check from EDS to classify products as new or existing product and consume only new products to EDS.


The Products loaded into CM54_data table are processed into SPI_products table 
based on the SYNCHRONIZATION_STATUS as 'PENDING' or 'SYNCHRONIZED' AND PRODUCT_UPDATE_DATE is more than Delta time and products are processed as

The Existing Mirakl products in SPI_PRODUCTS will be updated to EDS

New products accepted after EDS check will wait for oracle processing and will be synced with Mirakl

Existing core products will be temporarily rejected back to Mirakl.

More info: 


Product processing

 

EDS_endpoint: https://purchasingpower.syndigo.com/api/entityappservice/get
If the product got processed to SPI_products table, then the product will have a record_status of 'P' if not 'N' and they will be tracked through CM54_DATA_REJECT table

 

If any product is missed with product processing, then update CM54_DATA table record_status  to null and ETL_load_time to sysdate


image-20250807-121800.png
product processing
 

1.3. Sync product acceptance To Mirakl
Sync data back to Mirakl is done through CM21 call and is tracked through CM22 and CM23 calls of Mirakl which runs for every 10 minutes.

The products are synced with Mirakl with a status of accepted and rejected.
Every time we get new products from Mirakl we sync them back to Mirakl with the ORACLE_ID from PPC this gets us the offers flowing from Mirakl only If the products are accepted if not products are temporarily rejected to Mirakl based on the BIZ requirements.

Sync to Mirakl has three API calls (CM21,CM22,CM23)

Accept and Reject:

Accepted products will have product_set_up='N' and send_to_Mirakl='Y'

Rejected products are sourced from SPI_VI_REJECTS will have product_Set_up='VI'  and the Invalid data/Duplicate UPC’s are sourced from CM54 table will have product_set_up='D' or ‘T' and send_to_Mirakl='Y'

Products rejected due to the same products already exists in PIM will have product_set_up='X' and send_to_Miral='Y'

Rejects are picked from CM54 table if they have a status of ‘P' which are then updated to 'N’ after a successful load to SPI_PRODUCTS

1.3.1. CM21 call

API endpoint:

https://purchasingpowerus-dev.mirakl.net/api/mcm/products/synchronization

Method

POST

sample Request



{
      "acceptance": {
        "status": "ACCEPTED"
      },
      "mirakl_product_id": "19cc7c1e-5d3e-4e3c-8a3d-fc0309d8452b"
    }
Response

200

Sample Result

{   "tracking_id": "206886fc-60de-4fcb-932c-1df26231e013" }

-> If the API response from CM21 call is not 200 then the API_ERROR_DESC is tracked through CM21_tracking table, and this gets a Jira ticket created for the failure

-> API response is loaded directly to CM21 table as RESULT

-> This result is parsed and stored in CM21_DATA table which is then used in CM21 API call

1.3.2. CM22 Call

API endpoint

https://purchasingpowerus-dev.mirakl.net/api/mcm/products/synchronization/{tracking_id}

Method

GET

Response

200

Sample Result

{   "archived": false,   "failed": 505,   "has_report": false,   "partial_read": false,   "processed": 5606,   "status": "COMPLETE",   "succeeded": 5101,   "tracking_id": "06860fde-d975-4291-a1ed-3150809586a7" }

 This API call is used to check if the product synchronization has been processed.

-> If the API response from CM22 call is not 200 then the API_ERROR_DESC is tracked through CM22_tracking table, and this gets a Jira ticket created for the failure

-> API response is loaded directly to CM22 table as RESULT

-> This result is parsed and stored in CM23_DATA table and the same tracking_ID is used in CM23 API call

->Different status messages in CM22 call

If status is WAITING, QUEUED, or RUNNING:
→ The synchronization is still in progress. Wait and poll CM22 again (recommended: once per minute) until the status changes. (this is done for 9 minutes)

If status is COMPLETE:
→ The synchronization is finished. call CM23 to retrieve the synchronization report.

If status is FAILED:
→ The synchronization has failed. Do not call CM23. Instead, review the error details in the CM22 response and resolve the issue before retrying.

 

1.3.3. CM23 Call

Get product Synchronization report

Get the report for a products synchronization. The report returns the processed items with an additional synchronization_errors parameter if some errors occurred during the synchronization of an item.


API endpoint:

https://purchasingpowerus-dev.mirakl.net/api/mcm/products/synchronization/{tracking_id}/report

Method

GET

Response

200

 

Once the products are synchronized the products will have Send_to_Mirakl='P' if not it's still Y and will be reprocessed on any failures if the products even if the products are rejects.


image-20250807-122145.png
Sync to Mirakl
 

Jobs and the transforms included in Product creation:

Jobs in product Creation

Transformations

Input tables

Output Tables

Job_SPI_PRODUCTS

(In Job_SPI_Main)

SPI_V01_CALL

 

V01_TRACKING

SPI_CM52_CALL

 

CM52

CM52_TRACKING

SPI_CM52_PARSE

CM52

CM52_DATA

CM52_DATA_REJECT

SPI_CM53_CALL

CM52_DATA

CM53

CM53_TRACKING

SPI_CM53_PARSE

CM53

CM53_DATA

CM53_DATA_REJECT

SPI_CM54_CALL

CM53_DATA

CM54

CM54_TRACKING

SPI_CM54_PARSE

CM54

CM54_DATA

CM54_DATA_BAD_RECORD

Job_SPI_PRODUCT _PROCESSING
(in Job_SPI_Main)

Process_Products

CM54_data

SPI_PRODUCTS

SPI_CURRENT_PRODUCTS_V

CM54_DATA_REJECT

Job_SPI_Product_Feed_to_Mirakl

Rejects_to_Mirakl

CM54

SPI_PRODUCTS

SPI_VI_REJECTS

SPI_CURRENT_PRODUCTS_V

SPI_V01_CALL

 

V01_TRACKING

SPI_CM21_CALL

 

CM21

 

CM21_TRACKING

SPI_CM21_PARSE

CM21

CM21_DATA

SPI_CM22_CALL

CM21_DATA

CM22

CM22_TRACKING

SPI_CM22_PARSE

CM22

CM22_DATA

SPI_CM23_CALL

CM22_DATA

CM23

CM23_TRACKING

SPI_CM23_PARSE

CM23

CM23_DATA

2.Offer Decision Engine
What is an offer?
Offer is the price at which multiple vendors sell the same product. PPC can opt for the Vendor who provides the best price.
To get the best price from Mirakl offers BIZ has defined a set of rules

 Get lowest offer price from multiple vendors

Update Existing offers stock and prices in near real time

Update Existing offers stock and prices in near real time

These BIZ rules are implemented through Offer Decision Engine (ODE).

ODE consists of two steps:

Sourcing offers data from Mirakl [Job_SPI_Products]

Offer Processing [Job_SPI_Offer_Processing]

Offers Override by BIZ [from ODE UI]

 ETL will pull the offers data every 5 minutes. (OF52, OF53, OF54) from the previous successful run then assigns offers to the Products and calculates final base price.

2.1.   Sourcing offers data from Mirakl

ETL will pull the Offers data in JSON format from Mirakl every 5 minutes using three API calls: OF52, OF53 and OF54

Where DELTA_TIME is in UTC
2.1.1. OF52 Call:

API endpoint: 

https\://purchasingpowerus-dev.mirakl.net/api/offers/export/async

Method

POST

Request

{"export_type":"application/json", "last_request_date":"DELTA_TIME"}

Response

200

RESULT

{"tracking_id":"XXXXXXX"}

-> If the API response from OF52 call is not 200 then the API_ERROR_DESC is tracked through OF52_tracking table, and this gets a Jira ticket created for the failure

-> API response is loaded directly to OF52 table as RESULT

-> This result is parsed and stored in OF52_DATA table which is then used in OF53 API call
ETL will get a tracking id from OF52 call which will be used in OF53 call

2.1.2. OF53 Call:

API endpoint: 

https://purchasingpowerus-dev.mirakl.net/api/offers/export/async/status/{tracking_id}

Method

GET

Response

200

Sample Result

{"last_updated":"2025-02-21T09:25:10.910Z",

"status":"COMPLETED",

"urls":["https://purchasingpowerus-dev.mirakl.net/api/offers/export/async/file/8b397723-4a25-41fd-a6c5-61ccbb5f4961?file=of52-export%2Fpurchasingpowerus-dev%2F8b397723-4a25-41fd-a6c5-61ccbb5f4961%2F0.json"]}

This URL from OF53 Call as the API for OF54 Call.

Note:
 a) if the response is not 200 the status='FAILED' 
 b) if the response is 200 and status='COMPLETED' then good to proceed for CM54 and if URL is empty with status='COMPLETED' it means no changes are done in products API and we consider export as completed

E.g.: {"last_updated":"2025-02-23T12:40:10.725Z","status":"COMPLETED"}

c) if the status='PENDING' the same tracking id should be called till we get a status as completion
 d) if the response=200 and status is not ‘PENDING' or 'COMPLETED' then we consider the export is cancelled

 

All the content of OF53 call is parsed and stored in OF53_DATA (URL, Export status).

-> If the API response from OF53 call is not 200 then the API_ERROR_DESC is tracked through CM53_tracking table, and this gets a Jira ticket created for the failure

-> API response is loaded directly to OF53 table as RESULT

-> This result is parsed and stored in OF53_DATA table which is then used in OF54 API call

2.1.3. OF54 Call:

API endpoint: 

URL form OF53 Call

Method

GET

Response

200

-> If the API response from OF54 call is not 200 then the API_ERROR_DESC is tracked through OF54_tracking table, and this gets a Jira ticket created for the failure

-> The result from OF54 call has all offer details in a single Json, this data is parsed to a single offer Json and loaded to OF54 table.

-> The single Offer Json data will be parsed and loaded to OF54_data table, if anything fails to load to OF54_data table then the data will be loaded to OF54_BAD_DATA_RECORD

-> Offer export from Mirakl is completed in OF54_data table    

-> If the load is complete and success update OF54 table status as ‘Y’ for the offer

-> If the Offers have any failures, they will have the error_desc in OF54 table with a status='P'

 

image-20250807-122431.png
Offer data
Back Tracking: To track when the offer is loaded in UTC time. Back track form OF54_DATA table starting with OF54_SNO (OF54_DATA)->OF53_SNO(OF54) -> OF53_SNO(OF53_DATA)-> OF52_SNO(OF53) → OF52_SNO(OF52_DATA) [this gives the DELTA_Time to reprocess].

 

-> Offer export from Mirakl is completed in OF54_data table


2.2. Offer Processing
Once the Offer data is exported to OF54_DATA the offers are mapped to products in SPI_products table with the SNO in OF54_table corresponds to Offer_SNO in SPI_PRODUCTS table.

If a product has Oracle_ID as not null, send_to_Mirakl='P' and OFFER_SNO is null it refers that the product is yet to get an offer from Mirakl or it doesn’t have valid offers that we got from Mirakl

 

Offer processing consists of 4 pats

New Offer processing

Revised Offer Processing

Update Existing Offers

Invalid Offer processing

More Info:

Offer processing

 

New offer processing will get Offers assigned to products with missing offer_sno in SPI_Products table until an offer is assigned to the product.

Updating Existing offers includes updating stock changes via SPI_STOCK table and cost /price changes through EDS flow

Invalid offer processing includes picking best offers form the available offers and mapping with the product and making the current stock to zero in store front as the offer is no longer available.

2.3. Applying Offers from ODE UI
BIZ can validate offers form ODE UI and apply offers from the UI. This makes the current offer go invalid for PPC and continue with the offer by BIZ until it expires or override by BIZ.
More info:


Override Expectations

 

All the New offers and offers applied from UI will go through pricing calc and Feed to EDS jobs before they land to EDS as offer updates

To handle offers applied from UI and product processing in SYNC,
a transformation Offers_From_ODE_UI is in place this gets the offers applied from UI and send the updates to EDS if all the offers' data is valid.

image-20250807-130358.png
stock updates
Jobs in ODE

Transformations

Input tables

Output Tables

Job_SPI_Offers
(part of SPI_MAIN job)

SPI_V01_CALL

 

V01_TRACKING

SPI_OF52_CALL

 

OF52

OF52_TRACKING

SPI_OF52_PARSE

OF52

OF52_DATA

OF52_DATA_REJECT

SPI_OF53_CALL

OF52_DATA

OF53

OF53_TRACKING

SPI_OF53_PARSE

OF53

OF53_DATA

OF53_DATA_REJECT

SPI_OF54_CALL

OF53_DATA

OF54

OF54_TRACKING

SPI_OF54_PARSE

OF54

OF54_DATA

OF54_DATA_BAD_RECORD

Job_SPI_Offer_Processing

Offer_Processing_New

OF54_DATA

SPI_PRODUCTS

SPI_CURRENT_PRODUCTS_V

 

Offer_Processing_Update

OF54_DATA

SPI_PRODUCTS

SPI_CURRENT_PRODUCTS_V

SPI_STOCK

Offer_Processing_Invalid

OF54_DATA

SPI_PRODUCTS

SPI_CURRENT_PRODUCTS_V

SPI_STOCK

Job_SPI_Main

Offers_From_ODE_UI

SPI_CURRENT_PRODUCTS_V

SPI_PRODUCTS

3.Pricing Calculator
After the successful mapping of products with offers, based on the offer_price from the Offers picked from ODE / from ODE_UI a new base price is calculated from the POR set by BIZ.
If the categories from Mirakl are not in SPI_POR table Price_calc_exception will be marked with the missing category.


image-20250807-121343.png
Pricing Calculator flow
 

 

More Info:


PCal processing

Jobs in Pcal

Transformations

Input tables

Output Tables

Job_SPI_Pricing_Calculator
(part of SPI_MAIN job)

Pricing_Calculator

SPI_CURRENT_PRODUCTS_V

SPI_PRODUCTS

OF54_DATA

SPI_STOCK

CM54_DATA

 

SPI_POR

 

Price_Calc_Missing_POR_Error

SPI_CURRENT_PRODUCTS_V

SPI_PRODUCTS

SPI_POR

 

4.FEED to EDS
ETL After Product creation, ODE and Price calculation will send Data to EDS through Product_Feed_to EDS and Offer_Feed_to_EDS jobs.

1.Product_Feed_to_EDS will create new products in EDS and update existing products content in EDS.
2.Offer_Feed_to_EDS will update cost/price/vendor changes in EDS and these changes will automatically be triggered to PIM workflow.

->Both Product feed and Offer feed will have product mapping and Offer mapping along with vendor content which we get from Mirakl using S20 API call and the Feed is sent to EDS based on the Mirakl-ETL-EDS-Mapping Doc shared above.
 ->Product feed to EDS needs BIZ manual intervention and offer feed has no manual

Feed to EDS consists of three parts

Sourcing Vendor Data from Mirakl [Job_SPI_Shops]

Pushing Product_Offer Content to EDS[Job_SPI_Product_Feed_to_EDS]

Pushing Offer content to EDS [Job_SPI_Offer_Feed_to_EDS]

 

4.1. Sourcing Vendor Data from Mirakl
S20 is the API endpoint for list of shops 
ETL pulls list of shops from Mirakl for every 5 minutes based on the shops that are updated form the  Delta_Time in UTC 

S20 Call:

API endpoint

https://purchasingpowerus-dev.mirakl.net/api/shops?updated_since=2019-08-24T14%3A15%3A22Z

Method

GET

Response

200

The updated_since is the Delta_time in UTC formatted as per Internet standards.

-> If the API response from S20 call is not 200 then the API_ERROR_DESC is tracked through S20_tracking table, and this gets a Jira ticket created for the failure

-> The result from S20 call has all Updated shop details in a single Json, this data is parsed to a single shop Json and loaded to S20 table.
->The single Shop Json data will be parsed and loaded to CM54_data table, if anything fails to load to S20_data table then the data will be loaded to S20_data_bad_record table 
-> List of shops export from Mirakl is completed in S20_data table

->List of shops API provides PPC with Vendor_ID and shop status.
-> if the shop status is Suspended All the offers will become inactive until the suspension is revoked.


image-20250807-121529.png
Supplier data flow
4.2. Product Feed to EDS
Based on the Mirakl-ETL-EDS mapping All the products, offers and vendor content are sourced to EDS in a JSON file via MFT rule to Syndigo’s MFT Account for them to pick the file and process.

More info:


Product Feed to EDS

image-20250807-122703.png
Feed to EDS
image-20250807-122805.png
Product data from EDS
4.3. Offer Feed to EDS
Only Cost/Price/vendor changes are sourced to EDS in a JSON file via MFT rule to Syndigo’s MFT Account for them to pick the file and process.

-> New products from Mirakl in SPI_PRODUCTS table will only be sent via product file and will not trigger offer changes file. 
-> Offer feed to EDS triggers an automated workflow from EDS to PIM flow.


More Info:


Offer feed to EDS

 

image-20250807-123209.png
Offer data flow 
Jobs 

Transformations

Input tables

Output Tables

Job_SPI_Shops
(part of SPI_MAIN job)

   SPI_V01_CALL

 

V01_TRACKING

SPI_S20_CALL

 

S20_TRACKING

S20

SPI_S20_PARSE

S20

S20_DATA

S20_DATA_BAD_RECORD

Job_SPI_Product_Feed_to_EDS

Product_Feed_to_EDS

SPI_CURRET_PRODUCTS_V

 

Job_SPI_Offer_Feed_to_EDS

Offer_Feed_to_EDS

SPI_CURRET_PRODUCTS_V

 

5. POR File processing
->BIZ will place POR files in a file share location from which MFT will transfer the file from which Pentaho job pics the file and insert/update the existing POR values in SPI_POR table.
-> whenever a new category is updated with POR percentage, All the existing Products will be getting a new base price calculation through pricing calculator and the data will flow through EDS and Hybris.

 

More Info:


POR file processing

 

Jobs for POR processing

Transformations

Input tables

Output Tables

Job_SPI_Main

Check_SPI_POR_File_Exists

 

 

Job_SPI_POR_Processing

SPI_POR_Load

SPI_POR

SPI_POR

SPI_POR_Update_Base_Price

SPI_CURRENT_PRODUCTS_V

SPI_CURRENT_PRODUCTS_V

SPI_POR

 

 

6. VI rejects from EDS
-> BIZ users can reject Mirakl products from EDS which are accepted by Mirakl Operator from PPC

->Once the product is Rejected from EDS, a JSON file will be published from EDS which has the details of reason for the rejection and the user committed the rejection

-> Mirakl Products which are vendor item rejects will be synced back to Mirakl with the error message from the BIZ user 
-> If the error message from EDS is empty, the product will be rejected based on the username who rejected the product.

-> All the offers associated with the product will become inactive after VI reject is synced back with Mirakl

 

More Info:


VI rejects

Jobs for VI rejects

Transformations

Input tables

Output tables

Job_SPI_VI_Rejects

Get_VI_File_names

 

 

Process_VI_Reject_Files

 

 

Job_SPI_VI_Rejects_Reader

Load_SPI_VI_Rejects

 

SPI_VI_REJECTS

Job_SPI_Product_Feed_to_Mirakl

Rejects_to_Mirakl

SPI_VI_REJECTS

SPI_PRODUCTS

7.Automated brands
->Brands are synced from Mirakl to EDS

-> ETL pulls a value_list known as brand-list from Mirakl for every two hours

-> ETL will only sync new brands from the brand-list that are added from the previous run based on the existing brands data

-> Then create a JSON file to EDS via Moveit File transfer

VL11 Call:

API endpoint

https://purchasingpowerus-dev.mirakl.net/api/values_lists?code=brands-list

Method

GET

Response

200

All the content of VL11 call is parsed and stored in VL11 table

-> If the API response from VL11call is not 200 then the API_ERROR_DESC is tracked through VL11_tracking table, and this gets a Jira ticket created for the failure

-> API response is loaded directly to VL11 table as RESULT only if the result is not found

 

More Info:


Brands Automation

Jobs for brands creation

Transfromations

Input tables

Output tables

Job_SPI_Brands

SPI_VL11_CALL

VL11

VL11_TRACKING

VL11

SPI_VL11_PARSE

VL11

VL11_DATA

VL11_DATA

Brands_Feed_to_EDS

VL11_DATA

 

8.Automated categories
->Categories are synced from EDS to Mirakl

->ETL will pull the updated Categories from EDS twice a day based on Delta time

->The API Response from EDS will be Parsed and will create a new file which will be posted to Mirakl

->Categories will be posted to Mirakl via H01 and track its status from H02 and H03 API calls

8.1.EDS API for Categories:

API endpoint

https://purchasingpowerfs.syndigo.com/api/entityappservice/get

Method

GET

Response

200

Request

{"params":{"query": {"contexts": [{}],"filters":{"typesCriterion": ["classification"],"propertiesCriterion": [{"modifiedDate": {"gt": "DELTA_TIME_UTC","type": "_DATETIME"}}],"attributesCriterion": [{"rootexternalname": {"exact": "Master Taxonomy"}}]}},"fields": {"relationships": [""],"attributes": ["_ALL"],"properties": ["_ALL"]},"options": {}}}

-> ETL will pull the updated categories based on the Delta_time  and parses the API_RESULT to get

Category ID

Category Name

Parent Category Path

-> After extracting the data form API_RESULT, ETL will create a new CSV file to be posted for Mirakl category updates 
and these are the columns in CSV file which has “update-delete” as always update

"hierarchy-code";"hierarchy-label";"hierarchy-parent-code";"update-delete"

8.2. H01 Call:
Import a file to add operator's Catalog categories to Mirakl

->this is the only API for mirakl which required Posting a file

->once the file is posted to H01 API , a response of hierarchy code is generated

API endpoint

https://purchasingpowerus-dev.mirakl.net/api/hierarchies/imports

Method

POST

Response

200

Request

CSV file to be posted to the API

Sample Result

{"hierarchies_import_id":2081}

->If the API response from H01 call is not 200 then the API_ERROR_DESC is tracked through H01_tracking table, and this gets a Jira ticket created for the failure

-> API response is loaded directly to H01 table as RESULT

-> This result is parsed and stored in H01_DATA table which is then used in H02 API call
ETL will get a hierarchies_import_id from H01 call which will be used in H02 call

8.3. H02 Call:

API endpoint: 

https://purchasingpowerus-dev.mirakl.net/api/hierarchies/imports/{HIERARCHIES_IMPORT_ID}

Method

GET

Response

200

Sample Result

"{
  "has_error_report" : false,
  "import_status" : "COMPLETE"
}"

The import_status='COMPLETE' specifies that the import status is complete.
If the import is failed , the has_error_report is set true and then H03 is called to get the error report of failed categories

->All the content of H02 call is parsed and stored in H02_DATA (Import_status).

-> If the API response from H02 call is not 200 then the API_ERROR_DESC is tracked through H02_tracking table, and this gets a Jira ticket created for the failure

-> API response is loaded directly to H02 table as RESULT

-> This result is parsed and stored in H02_DATA table which is then used in H03 API call (only when needed)

8.4. H03 Call:

error report for categories

API endpoint: 

https://purchasingpowerus-dev.mirakl.net/api/hierarchies/imports/{HIERARCHIES_IMPORT_ID}/error_report

Method

GET

Response

200

->Based on the result from H02 call, H03 call is triggered to get the error reason from H03 call

Jobs in Categories

Transformations

Input tables

Output tables

H01_CALL

 

 

 

Job_SPI_Categories

Categories_From_EDS

 

 

SPI_H01_CALL

 

H01

H01_tracking

SPI_H01_PARSE

H01

H01_DATA

SPI_H02_CALL

H01_DATA

H02

H02_tracking

SPI_H02_PARSE

H02

H02_DATA

SPI_H03_CALL

H02_DATA

H03

H02

H03_tracking

H01_DATA

 

SPI_H03_PARSE

H03

H03_DATA

9. Operational reporting:
For track the offer changes for SPI dashboard, offer changes are tracked through SPI_OFFER_CHANGES table, 
values are tracked for reporting:

CURRENT_OF54_SNO : New SNO in OF54_DATA table for an offer_id

PREVIOUS_OF54_SNO : Existing SNO in OF54_DATA table for an offer_id , if any value exists

SHOP_SUSPENDED : Set Flag='Y' if the vendor proving this offer got suspended

SHOP_CLOSED : Set Flag='Y' if the shop proving this offer got closed

PRODUCT_REJECTED : Set Flag='Y' if a particular product is rejected by any reason

PRODUCT_DELETED : Set Flag='Y' if a particular product is deleted (future enhancement)

STOCK_LEVEL_ZERO : Set Flag='Y' if the offer became inactive due to no stock

OFFER_EXPIRED : Set Flag='Y' if the offer became inactive due to offer expiry date

PRODUCT_COST_CHANGED  : Set Flag='Y' if the product cost got updated from the offer update

OFFER_PRICE_CHANGED : Set Flag='Y' if the offer price got updated from the offer update

PRODUCT_COST_GREATER_OFFER_PRICE: Set Flag='Y' if the offer price is less than product cost for the current offer

OFFER_DELETED :   Set Flag='Y' if the offer became inactive due to offer deletion

 

Tableau data source is using this SPI_OFFER_CHANGE table for reporting 


Jobs in Categories

Transformations

Input tables

Output tables

Job_SPI_Operational_Reporting

SPI_Offer_Changes

SPI_CURRENT_PRODUCTS_V

SPI_OFFER_CHANGES

S20_DATA

OF54_data

 

10. Troubleshooting:

If any data is reported as incorrect in EDS first check the respective UPC in CM54_DATA table
-> select * from ETL_SPI_DATA.CM54_DATA where UPC='123456' order by etl_load_time desc;

If any product is reported as changes required in Mirakl with Invalid data as reject reason 
-> select  * from ETL_SPI_DATA.CM54 where UPC='123456' order by etl_load_time desc;
(can be tracked through operational reporting) 


image-20250807-130621.png
Invalid data rejects
Products failed to process via UPC check
- if the product has record_status='E' in CM54_DATA then the UPC failed to process via UPC 

SELECT * from ETL_SPI_DATA.CM54_DATA_REJECT where CM54 SNO in(select SNO from ETL_SPI_DATA.CM54_DATA where UPC=’UPC’ and record_status!='P')

If any product is reported with offer is missing then
-Select * from ETL_SPI_DATA.OF54_DATA_BAD_RECORD where oracle_id='Oracle_id';

If any product is missing with vendor_id / incorrect Vendor id is associated with product
-Select * from ETL_SPI_DATA.S20_DATA_BAD_RECORD; – for missing vendor_id
-fix vendor_id in mirakl and update the affected Products to process

Product is missing with MFG number in EDS
-Ensure the product category is configured with is_variant flag as required attribute
-Update product data the changes will make to EDS


image-20250807-132202.png



Related content

title: Request to add former Fedgov customer to PPC select

There will be requests in DATA board from Business to add list of former fedgov customers in PPC select

Below Customer details will be shared in the ticket


image-20251210-111556.png
Prepare an insert statement using the customer data shared in the ticket

insert into etl_file_data.PPCSELECT_INVITE_LIST (CUSTOMER_ID, CLIENT_ID, ACCOUNT_NAME, EMAIL, FIRST_NAME, LAST_NAME, FULL_NAME, IDENTIFIED_DATE, CLIENT_CD, CREATE_DATE,APP_SUPPORT_COMPLETE)

 values ('<CID>','2049','FEDERAL GOVERNMENT/POSTAL SERVICE','<email>','<firstname>','<lastname>','<fullname>',sysdate,'GOV',sysdate,'N');

 

Share the insert statement with the lead/manager, after review this will be executed.

title: Steps to validate user account logs in moveit transfer

Login to Purchasingpower 

Users → filter users → where value like - give the user account name → apply filters


image-20251210-112259.png
Click on the required user account


image-20251210-112507.png
 

Click on the 'view user logs'


image-20251210-112734.png
Select required date range
disable ‘Suppress Sign on/Sign Off' if you need to verify user sign on details, to confirm if user has logged in
enable ‘Suppress Sign on/Sign Off' if you only want to see file related activity


image-20251210-113053.png
This displays all log entries related to file upload/download/delete



image-20251210-113312.png
Using above logs we can confirm the respective files were uploaded or downloaded

In case of failure, the log entry will look like below and by clicking on the 'Date and Time' we will have the failure details

title: Pentaho Job Control Framework
Overview
This framework is designed to control and limit the number of concurrent jobs running on a Pentaho server. It ensures jobs do not exceed configured run limits, handles notifications (email/Jira), and maintains robust logging and cleanup.

In this page, we will look into how the job control framework is designed and how new jobs should be integrated, pros and cons of this framework

The Why?
If a scheduled job is running for more than the assumed runtime, exceeding the next scheduled run time, same copy of the Job will run in parallel with the existing jobs.
due to this

High CPU is utilization if multiple jobs run at the same time

Few jobs will be skipped and if all the 21 threads are blocked by jobs during the scheduled runs

Deadlocks if the same data is used concurrently

Duplicates in the data, if necessary, steps are not taken

The How?
How to resolve all the issues, the solution is to not run same copy of job concurrently (even if the scheduled run time is increased, there are still chances of the same issue as we have no control on the job runtime)

→ to achieve the single job running in the server, there is no built-in option to block the job to trigger if the same copy of job is running in the servers, so a new workflow is needed to prevent the jobs triggering

->A Main job will be built on the existing job to achieve, fetch the number of runs of the job and proceed to trigger the main job

image-20250923-122342.png
Design
-> The functionality to prevent multiple copies of job is handled using ETL_MFT.Job_Control_log table
-> new transform Job_Control_Start is used to identify a job is running

-> Job_Control_End is used to reset the count level to zero if the job has successfully 


process flow:


[Job_Control_Start] 
        |
   [Job needs to be handled]
        |
[Job_Control_End]
1. Job Control Start (Job_Control_Start.Ktr)
Purpose
This transformation is designed to control and limit the number of concurrent job runs on a server.

It checks the current run count (based on run limits), compares it with the allowed limit, and handles job skipping and notifications if limits are exceeded.

Key Logic
Variable Initialization:
Loads job-specific variables such as Job_Name, email settings, and Jira project details.

Database Join:
Queries the Job_Control_log table to fetch the current number of runs, run limit, skipped runs, and ticket status for the job.

Run Limit Enforcement:

If NUMBER_RUNS < RUN_LIMIT: Job proceeds.

Else: Skipped runs incremented,

if skip count exceeds the max configured skips from Job_Control_log , then create a new Jira ticket and update the ticket key in Job_Control_log using a defined shell script from "/var/cache/pentaho/srcfiles/global_Scripts/DATA_jira_api.sh"

if a Jira ticket is created and skip_runs are more than expected comment in the ticket_key from Job_Control_log using defined shell script "/var/cache/pentaho/srcfiles/global_Scripts/DATA_jira_comment.sh"

Abort Steps:

If the job must be skipped, abort steps are triggered to stop further processing.

Jira Ticket Handling:
If the job is skipped due to exceeding the run limit, it can create a Jira ticket or add a comment to an existing ticket.

Email Notifications:
Sends emails to notify about job skips or Jira ticket creation/failure.

Typical Output
Updates the Job_Control_log table with new run/skipped counts and ticket info.

Sends notifications as needed.

Aborts the job if the run limit is reached.

2. Job Control End (Job_Control_End.ktr)
Purpose
Performs cleanup and final logging after job execution.

Updates job control tables and transitions Jira tickets if needed.

Key Logic
Variable Initialization:
Loads job-specific variables.

Database Updates:
Updates the Job_Control_log table to reflect job completion, including run counts back to zero and ticket status to null.

Jira Ticket Transition:
May trigger a Jira ticket transition to done when required, by adding a comment of closing ticket after 'N' runs are skipped using “/var/cache/pentaho/srcfiles/global_Scripts/DATA_jira_transition.sh”

Logging:
Writes job execution details to the log for auditing and monitoring.

Notification:
Jira will trigger an automated notification for ticket transition as the assignee is PROD_ETL_SERVER

3. Main Job Example (Job_PIM_API_Main)
Purpose
Orchestrates ETL jobs with job control start/end transforms.

Ensures jobs only run if allowed and logs all activities.

Structure & Flow
Job Entries
Start: Entry point.

Job_Control_start: Executes the start control transformation.

to_hybris: Runs the main ETL job (Job_PIM_API_POST).

to_EDS: Runs a secondary ETL job (Job_PIM_Oracleid_to_EDS).

Job_Control_end: Executes the end control transformation.

Success: Marks job completion.

Job Hops (Flow)
Hop flow should always be set conditionl success

Best Practices
Always use Job_Control_start before main jobs to enforce run limits (/public/global_reusable/transform/Job_Control_Start)

Always use Job_Control_end after main jobs for cleanup and logging.
(/public/global_reusable/transform/Job_Control_End)

Configure notifications and Jira integration as needed for your environment (non-prod will not create Jira tickets).

Configure the Number Runs(allowed runs), allowed skipped_runs , in Job_Control_log table

Insert a new record for a new job ETL_MFT.Job_Control_log  table by configuring run_limit of and skip_limit as needed

Ensure Job_Name parameter is set in MAIN job which should be inserted to the table

Insert into ETL_MFT.job_control_log (JOB_NAME,NUMBER_RUNS,RUN_LIMIT,SKIPPED_RUNS,SKIP_LIMIT)

values ('Job_SPI_Main',0,1,0,3),('Job_PIM_API_Main',0,1,0,3) ;  


Ensure the Main job not to break if something is broken in the original job.

Pause the Main jobs in advance if any scheduled restart is planned

Ensure a new Master job exists for the Main job

Ensure all the transformations are error handled (if not add add dummy and success as the error handling) to ensure the code not to be broken by any failures which retains the functionality

Troubleshooting:
If the job is stuck and never made to job_control_end ,results continuous skips/alerts, which needs an update to Job_Control_log tables  number_runs to zero

Customization
Add more ETL jobs between start and end controls as needed.

Modify run limits and notification logic in the control transforms to suit your requirements.

Integrate with other monitoring or alerting systems if needed.

Summary
This job control framework ensures robust, scalable, and auditable ETL job execution in Pentaho. By combining start/end control transforms with your main jobs, you can enforce concurrency limits, automate notifications, and maintain clean logs.

Step

Purpose

Key Actions

Step

Purpose

Key Actions

Job_control_Start.Ktr

Pre-checks, run limit enforcement, notify

DB check, Jira/email, abort if needed

Main Job(s)

ETL logic

Runs only if allowed by start control

Job_Control_End.ktr

Cleanup, logging, post-job notifications

DB update, Jira transition, log, notify

title:New Pentaho DEV server testing

SNO	Issue	Issue Date	Action taken	Comments	Status	Resolved date	Resolution
1	server issue in running master jobs as in kettle properties file server details pointed out to trey server which is not active now				Open		
2	Got oracle.jdbc.driver.OracleDriver issue. As it is not available got this issue.	5/21/2026	Informed windows team  and later they have copied ojdbc file to Pentaho 11 ans issue got resolved		closed		
3	In Pentaho 11 no one have save access. Only admins can have save access. 				Open		
4	Mount points are not added for server 2 and server3 .Because of this job is not picking files in these server.	5/29/2026	Informed windows team  and later they have added mount points in server 2 and 3 and issued resolved	Issue resolved now.	Closed		
5	C4C trasfromation data log is saving in stf instead of dev table.			need to create a new wallet and add the certificate DBA is working on it.			
6	Getting etl_mft error.						
7	not able trigger jobs from the kettle/status UI : which works in 9.3						
	pim testing 						
	missing columns in PIM_PRODUCTS and PIM_PRODUCTS_REJECTS 		added columns in devetl				
	Hybris URL pointed to d2		corrected it back to D3 in all servers				
	Issues with log tables 			Issue resolved now.			
	Issues with DB connections		overrided them to test the flow				
	Cost_Change folder missing in the new mount point 		created new folder				
							
	SPI Testing						
	missing columns in CM54_DATA and CM54_DATA_BAD_RECORDS		added columns in devetl				
	Missing brnads, categories, offer and product folders in mount point		created new folder 				
	Missing OF54_SHIPPING_DATA table			waiting on DBA			

  Use case	Expectation	Result
Shops API	Pull shops API results in delta time	Data retrival success
Shops loader	parse API respnse and load it to tables	Data loaded to S20_DATA
Products API	pull products API in CM52, CM53,CM54 APIs	Data retrival success
product loader	parse 3 APIs and load data respectively	Data loaded to CM54_DATA,CM53_DATA and CM52_DATA
Offers API	pull products API in CM52, CM53,CM54 APIs	Data retrival success
Offer loader	parse 3 APIs and load data respectively	Data loaded to CM54_DATA,CM53_DATA and CM52_DATA
Product processing 	Hit EDS API and get results back to calssify core and mirakl products	worked as expected
Offer processing	Offers assigned and got disaccociaed with products when not applicable	worked as expected
Stock updates	Data loaded to SPI_Stock tables	worked as expected
pricing calculator	products eligibile for pricing got base_price calculated	worked as expected
product Feed to EDS	eligible products to be in product file to EDS	New files created in \\vault-dal\ETL\PIM\product
offer feed to EDS	eligible offers to be in offer file to EDS	New files created in \\vault-dal\ETL\PIM\offer
POR updates	POR file neeeds to consumed and data to be updated in SPI_POR table	POR updated for category 15_lt_luggage_backpack_lpbags
Brand updates	pull data from VL11 API	retrived data from VL11 API
Brand file to EDS	only new brands to be in the file to EDS	only new brands created in the file
Category upadtes from EDS	pull Category upadtes from EDS	New files created in \\vault-dal\ETL\PIM\categories
Post category data to Mirakl	Use H01 API to post data and get the sucess and failure results in H02, H03	Posted file to H01 and got suecess results in H02 and H03 and data has been laoded to H01,H02 and H01_DATA and H02_DATA
SPI VI rejects	load VI rejcects file to SPI_VI_REJECTS	Data loaded to SPI_VI_rejects as expected
Products sync with Mirakl	Use APIs CM21,CM22,CM23	Posted rejected data to Mirakl
Parse product sync results	Parse results from CM21 , CM22,CM23	Parsed API responses from CM21, CM22, CM23 and loaded to the tables as expected
POR price upadtes	Calcualte base_price on POR updates	Price calculator triggered the base_price upadtes and new offer file created
logging	logging in log_job and log_transform	logging worked as expected
SPI skips	only single copy runs	worked as expected
kettle properties	Use kettle properties across SPI jobs	EMail , SPI URL and tokes , EDS URL and tokens ,and file paths are used from kettle properties file
operational reporting	Upadte SPI_operational reporting on offer updates	Currnet and previous offers updated as expected
Shipping data	Retreive offer realetd shipping data on delta time	Shipping data has been added to OF54_Shipping_data on delta time


title: CDP_PROMO_AFFINITY
Objective

This process identifies customer promotion behaviour by analysing past orders and determining:

Which promotion type a customer is associated with

How frequently they used promotions

Customer and their most probable promo

 This helps us to:

Understand customer buying patterns

Design targeted promotions

Improve marketing effectiveness

Please find the attached document for more detailed information.
CDP_PROMO_AFFINITY 

 

1. Objective 

This process identifies customer promotion behaviour by analysing past orders and determining: 

Which promotion type a customer is associated with 

How frequently they used promotions 

Customer and their most probable promo 

 This helps us to: 

Understand customer buying patterns 

Design targeted promotions 

Improve marketing effectiveness 

 

 

 

 

 

1. Data Sources Used 

 Source 1: Customer Orders 

Contains:  

Customer ID 

Order details 

Promotion codes 

Order date 

Source 2: Rules 

Maps:  

Promo Code → Promo Sub Code 

Source 3: Promotion Type Mapping 

Maps:  

Promo Sub Code → Promo Type 

 

 

4. Step-by-Step Business Logic 

 Step 1: Extract Customer Transactions 

System reads last 2 years of order data 

Filters:  

Customers with more than one order 

Only valid orders where (promo_code IS NOT NULL OR promo_cd_2 IS NOT NULL) AND order_type IS NULL 

 

 Step 2: Clean Promotion Codes 

Promo codes may contain extra symbols like $ 

These are removed to standardize format 

 

Step 3: Map Promo Code → Promo Sub Code 

Using rules table, system finds:  

Which internal promo group the code belongs to 

If multiple sources exist: 

System picks the first available valid value 

 

Step 4: Filter Valid Records 

Only records with valid mapped promo values are kept 

Invalid or unmapped records are removed 

 

Step 5: Map Promo Sub Code → Promo Type 

Converts technical codes into business categories 

 Example: 

PROMO_SUB_TYPE → PROMO_TYPE 

 

Step 6: Aggregate Customer Data 

System calculates: 

Promo usage count (how many times customer used promotions) 

Latest order date 

 Grouping is done by: 

Customer ID 

Promo Type 

 

Step 7: Select Best Record per Customer 

Removes duplicates 

Keeps the most relevant record per customer 
(based on usage and latest activity) 

 

 Step 8: Add Execution Info 

Adds system execution timestamp for execution date output field  

 

Step 9: Generate Output File 

Final Output contains: 

Customer ID 

Promo Type 

Execution Date 

 File is generated in CSV format 

 title: EDM – Data Pipeline Architecture

Sources:

Source Type

System Name

Description / Notes

On-Prem Database

Prodfin

Core financial data repository

On-Prem Database

Hybris

Product and catalog management system

On-Prem Database

MTTR

Maintenance and turnaround tracking

On-Prem Database

PFR

Performance and forecasting repository

REST API

Responsys

Cloud-based campaign and messaging platform

Kafka Connect – Ingestion Layer

fd905a32-f8ec-47ed-b103-b2e38d61aaf0.png
Component

Description

Functionality

Captures both delta and bulk loads from source systems

Transformation

Performs message transformation and schema registration via Schema Registry

Output Format

Publishes data in Avro format for consistency and downstream compatibility

Kafka – Streaming Layer

Copilot_20250912_144900.png
Component

Description

Data Landing

Manages initial data ingestion and buffer storage

Schema Support

Resolves schemas dynamically to ensure compatibility across consumers

Offset Tracking

Maintains consumer offsets for reliable message processing

Partitioning

Enables scalability and parallelism through topic partitioning

Retention Policy

Temporarily retains data for replay/recovery (configured as a 7-day buffer)

ZooKeeper – Cluster Management

Component

Description

Coordination

Orchestrates Kafka cluster operations, including broker registration and leader election

Metadata Storage

Stores offsets, topic configurations, and other critical metadata

Reliability

Ensures fault tolerance and high availability across distributed components

Schema Registry – Schema Management

Copilot_20250912_150517.png
Component

Description

Versioning

Maintains schema versions for evolving datasets

Schema Evolution

Supports backward and forward compatibility to avoid pipeline breakage

Consistency

Ensures uniform schema enforcement across ingestion, streaming, and storage layers

Spark Streaming – Real-Time Processing

Copilot_20250912_152228.png
Component

Description

Ingestion

Consumes data from Kafka in near real-time

Processing

Performs cleansing, validation, enrichment, and staging

Throughput

Handles up to 90,000 records per topic per run

Output Targets

Feeds processed data into ElasticSearch and other downstream systems

ElasticSearch + Kibana – Search & Monitoring Stack

Component

Description

ElasticSearch

JSON-based data warehouse optimized for fast indexing, search, and analytics

Kibana

Interactive UI for monitoring, visualization, and data exploration

Index Management

Indexes are continuously monitored, optimized, and tuned for performance and reliability

Spark – Batch Processing

Component

Description

Transformations

Executes complex logic including SCD Type 2, upserts, and data enrichment

Data Modeling

Supports loading of dimensional and fact tables for analytical workflows

Orchestration

Integrated with Airflow for scheduled execution and dependency management

 

Greenplum – Analytical Warehouse

Component

Description

Storage Layer

Hosts processed relational data models for analytics and reporting

Performance

Supports high-performance SQL queries across large-scale datasets

BI Integration

Serves as the foundation for business intelligence tools and dashboards

Data Ingestion

Receives data via Spark pipelines and direct ingestion mechanisms

Amazon S3 – Cloud Storage Layer

Component

Description

Storage Use

Hosts backups, staged data, and external datasets

Data Operations

Supports uploading, downloading, and archiving workflows

Greenplum Integration

Acts as an external table source for analytical queries and ingestion

Tableau – Business Insights Platform

Component

Description

Semantic Layer

Provides a user-friendly abstraction over complex data models

Visualization Tools

Enables creation of dashboards, reports, and interactive charts

Decision Support

Transforms raw data into actionable insights for business stakeholders

Business Value of the EDM Platform

Value Area

Description

Secure Ingestion

Ensures safe data flow via Kafka Connect with no direct DB connections

Scalable Architecture

Designed to handle high-volume workloads with resilience and fault tolerance

Hybrid Processing Support

Supports both real-time streaming and batch ETL workflows

Insight Delivery

Enables fast, reliable access to actionable insights for decision-makers

Cost & Performance

Optimized for resource efficiency, reducing infrastructure overhead and latency

Key Capabilities:

Secure ingestion without direct on-prem connections

Schema evolution support with Avro

Scalable processing with Spark

Relational analytics in Greenplum

Real-time & batch data pipelines

Business Value:

Reduced risk & improved compliance (no direct DB connections)

Scalability for millions of records

Faster time-to-insight for business users

Cost savings via elastic scaling & decommissioning unused systems

Achievements:

Decommissioned legacy systems (Dremio,BroadFin)

Optimized ElasticSearch usage (cluster reduction possible)

Successfully migrated workloads to Greenplum + Tableau

Future Roadmap:

Optimize cloud cost with ElasticSearch decommissioning

Expand automation via Airflow scheduling

Explore AI-driven insights on curated datasets

Treasury DataTape Daily – Automated Validation & Self-Healing Enhancement
Overview:
The Treasury DataTape Daily process has been enhanced to include automated, proactive data validation and self-healing capabilities. This improvement addresses previous challenges with manual investigation and delayed resolution of data mismatches between Oracle, Elasticsearch, EDM Greenplum, and the final daily tape.

Key Features:

Automated Data Validation:

Compares record counts and key financial metrics (e.g., sale info) across Oracle source, Elasticsearch, EDM Greenplum, and the daily tape output.

Validates data consistency at each stage, ensuring early detection of mismatches.

Self-Healing Logic:

Automatically identifies and remediates common sync issues without manual intervention.

Triggers ES-to-Greenplum data sync and updates the daily tape with missing or corrected records as needed.

Remediation Logging:

All remediation actions (e.g., upserts, deletions, sync triggers) are logged for audit and traceability.

Continuous Processing:

The DAG continues processing after automated remediation, reducing business impact and developer effort.

Technical Implementation
Certainly! Here’s an elaboration on the key functions added for the Treasury DataTape Daily enhancement:

Function Details
1. data_extract_oracle(query)
Purpose:  
Extracts data from the Oracle source system using a provided SQL query.

How it works:  
Utilizes Spark’s JDBC connector to securely connect to Oracle, execute the query, and load the results as a Spark DataFrame for further processing.

Usage:  
Enables dynamic extraction of contract and sales data for validation against downstream systems.

2. upsert_xxcon_contract_stage()
Purpose:  
Ensures the xxcon_contract_stage table in Greenplum is synchronized with the latest data from the staging area.

How it works:  

Deletes records in xxcon_contract_stage that match keys in the staging table.

Inserts updated records from the staging table into xxcon_contract_stage.

Uses Python’s psycopg2 library for transactional database operations.

Benefits:  
Automates the refresh of contract data, reducing manual intervention and ensuring data consistency.

3. upsert_treasury_datatape_daily(order_ids)
Purpose:  
Updates the treasury_datatape_daily table in Greenplum with the latest records for specified order IDs.

How it works:  

Deletes existing records for the given order_ids and date.

Inserts the latest data from the view nls_treasury_datatape_daily_v.

Ensures only accurate and up-to-date records are present in the daily tape.

Benefits:  
Automates correction of missing or mismatched records, supporting the self-healing process.

4. Validation SQL Logic
Purpose:  
Detects mismatches in key financial fields (orderid, soldto, soldamt, soldpool) between Oracle, Greenplum, and Elasticsearch.

How it works:  

Runs Spark SQL queries to compare datasets from each system.

Identifies discrepancies and triggers remediation functions as needed.

Benefits:  
Enables proactive detection and resolution of data inconsistencies before business impact.

Summary:  
These functions collectively automate the validation and remediation of data across Oracle, Elasticsearch, and Greenplum, ensuring the Treasury DataTape Daily process is robust, reliable, and requires minimal manual oversight.

Business Impact:


Reduces manual investigation and accelerates issue resolution.

Ensures data consistency across all critical systems before business consumption.

Improves reliability and trust in daily Treasury DataTape outputs.

title:Monthly Treasury DataTape ETL - Overview

Details:

Trigger DAG
   │
   └── portfolio (Notebook Execution on EMR)
          │
          ├── Success → Complete
          └── Failure → Retry (x2) → Jira Ticket + Email Alert

 

Metadata:

Attribute

Details

DAG ID

EDW_portfolio_bulk

Owner

EDM_Load

Notifications

datateamnotification@purchasingpower.com

Schedule

Manual trigger only (no cron)

Retries

2 attempts (5-minute gap between retries)

Concurrency

Max 1 active run; no catch-up for missed runs

Start Date

Current day when deployed

 

Task: portfolio

Operator: SSHOperator

Action: Connects to EMR cluster and runs a Jupyter notebook job stored in S3.

Command executed:



sh /mnt/usr/local/src/batch/ipynb_trigger/runJob.sh \
   s3://ppc-edm-prod-ds/studio/e-BLF7HJSHQTMI9GT5SOG7MTU31/Prod/Portfolio_bulkload.ipynb
Timeout: 1 hour

Failure Handling
Retries task twice before marking as failed.

If still failing:

Runs jira_ticket_raise.sh to auto-create a Jira ticket.

Sends details (task ID, failure logs, batch type) with the ticket.

Team alerted via email.

List of all the table and views usage for understanding

ODS Layer – Landing Zone

EDW Layer - Warehouse Zone

 

Table / View

Layer

Purpose

Explanation

xxapps.xx_pfr_recon_nls (Oracle)

Source (Oracle)

Raw source table

Holds transaction-level portfolio reconciliation data in Oracle, serving as the pipeline's starting point.

ods.xx_pfr_recon

ODS (Greenplum)

Landing table

Stores raw data from Oracle, with columns standardized to lowercase and audit fields added. 

edw.portfolio_current

EDW (Greenplum)

Main fact table (current)

Contains the latest portfolio data snapshot after transformations, joining with dimensions for enriched reporting. 

edw.portfolio_snapshot_hist_fact

EDW (Greenplum)

Historical archive

Stores the previous version of portfolio_current before refresh. 

edw.customer_dim

Dimension

Customer details

Provides customer attributes (demographics, IDs, mapping).

edw.client_dim

Dimension

Client mapping

Maps portfolio records to client identifiers. .

edw.eligibility_dim

Dimension

Eligibility reference

Provides eligibility rules for portfolio records. 

edw.contract_dim

Dimension

Contract reference

Adds contract-level metadata .

edw.acct_dim

Dimension

Account reference

Maps transactional records to account-level attributes .

ods.treasury_datatape_monthly_fn (Function)

Treasury Layer

Reporting feed

Stored procedure/function triggers at the end, generating Treasury Monthly Data Tape .

Attached list of views and corresponding tables used for the function treasury_datatape_monthly_fn

 

View Name

Corresponding Table(s)

Source tables

ar_cust_trx_fact_v

nls_cust_trx_fact

loanacct_custom_pay_sched

loanacct

loanacct_trans_history

_ppc_loan_transaction_code_attributes

LOANACCT_COLLATERAL

batch_transaction

client_dim_v

client_dim

 

contract_fact_v

ods.xxcon_contract_stage

 

customer_dim_v

customer_dim, edm_security_policy

 

order_transaction_fact_v

order_transaction_fact

 

payment_schedules_all_fact_v

nls_payment_schedule_fact

 

portfolio_snapshot_fact_v

portfolio_current (aliased as portfolio_snapshot_fact_june), edm_security_policy

 

treasury_datatape_monthly

ods.treasury_datatape_monthly (target table where final results are inserted)

 

Manual Recovery Step (Run Notebook in Jupyter if DAG Fails)

Utility Functions:
run_presql(schema, table)

Prepares the target table by truncating it (clears old data).

WriteGP(schema, table, df)

Writes processed Spark DataFrame to Greenplum.

Adds metadata columns (created_ts, updated_ts, created_user, updated_user) automatically.

DecimalCasting(df)

Converts numeric columns to appropriate types for processing.

 

Source Data Extraction:
Data Source: Oracle table xxapps.xx_pfr_recon_nls.

Steps:

Get min and max values of partition column (recnum) to define batches.

Read data from Oracle in parallel batches using Spark JDBC.

Standardize column names (lowercase).

Load Data to Staging Layer
Staging Table: ods.xx_pfr_recon

What happens:

Extracted data from Oracle is written to Greenplum.

Table is truncated first to remove old data, then loaded with fresh data.

Transform & Load to Target Layer
Target Tables:

portfolio_current – current portfolio snapshot

portfolio_snapshot_hist_fact – historical snapshot

Steps:

Historical snapshot updated by moving current data from portfolio_current.

Transformations & joins applied:

Combine data from multiple sources (customer, eligibility, contract, orders).

Calculate metrics like sold_price, chargeoff_amt, aging buckets, opb.

Insert transformed data into target tables.

Post-Load Operations
Analyze Tables: Run ANALYZE on tables to refresh statistics for Greenplum.

Call Stored Procedures: For business-specific calculations, e.g., treasury data tape monthly update.

Logging: Print timestamps for load completion.

 

Run the Script in Order 
Truncate staging table
The script truncates the ods.xx_pfr_recon table before loading. Run manually:



TRUNCATE TABLE ods.xx_pfr_recon;
Load data into staging
Normally, the PySpark script writes Oracle data to Greenplum.

If doing manually, you need an intermediate CSV/Parquet exported from Oracle and then loaded:



-- Example: copy CSV into staging
\copy ods.xx_pfr_recon FROM '/path/to/data.csv' CSV HEADER;
Ensure columns match and data types are compatible.

Historical backup
Move current portfolio data to history:



INSERT INTO portfolio_snapshot_hist_fact
SELECT * FROM portfolio_current;
Truncate target table
Clear current portfolio table:



TRUNCATE TABLE portfolio_current;
 

Load transformed data
Run the long SQL insert query manually. Example:



INSERT INTO edw.portfolio_current (
    clientid, ending_bal_120105, rtn_cm, ...
)
SELECT
    perf_recon.clientid,
    perf_recon.ending_bal_120105,
    perf_recon.rtn_cm,
    ...
FROM ods.xx_pfr_recon perf_recon
LEFT JOIN edw.customer_dim customer ON ...
LEFT JOIN edw.eligibility_dim eligibility ON ...
LEFT JOIN edw.client_dim client ON ...
LEFT JOIN contract_fact_v contract ON ...
LEFT JOIN ods.order_header_stage orders ON ...
;
Make sure all joins are valid.

Run in sections if the query is too long to avoid timeout.

Post-load operations
Analyze tables for query performance:



ANALYZE ods.xx_pfr_recon;
Run stored procedures/functions:



SELECT ods.treasury_datatape_monthly_fn(
    CAST(date_trunc('MONTH', now()) - INTERVAL '1 day' AS date)
);
Validate
Check counts:



SELECT COUNT(*) FROM portfolio_current;
SELECT COUNT(*) FROM portfolio_snapshot_hist_fact;
Spot-check a few records:



SELECT * FROM portfolio_current LIMIT 10;

title: Daily Treasury DataTape ETL - Overview

Trigger DAG
   │
   └── Check Time & Day
          │
          ├── Skip if Weekend or After 8:30 PM
          └── Proceed if Valid
                 │
                 └── Run Notebook on EMR (Push Data)
                        │
                        ├── Check Latest Load Status
                        │     └── Retry up to 25x (15-min gap)
                        │
                        └── On Success → Send Email Notification

Attribute

Details

DAG ID

Treasury_DataTape_Daily

Owner

EDM_Validation

Notifications

datateamnotification@purchasingpower.com

Schedule

Weekdays only (Mon–Fri) at 1:00 PM EST (00 13 * * 1-5)

Retries

25 attempts for status check (15-min sleep between retries)

Concurrency

Max 1 active run; max 2 active tasks; no catch-up

Start Date

August 7, 2025

Timeout

DAG run timeout: 4 hours (14,400 seconds)

Trigger Logic

Skips weekends or post-8:30 PM runs; sends failure alert if preload fails

Execution

SSHOperator triggers notebook on EMR; status check via PythonOperator

Success Alert

Email sent to Treasury + Data Team upon successful load

List of all the table and views usage for understanding

Source System

Object Type

Schema

Name

Notes

Greenplum (EDM)

Table

ods

nls_pfr_preloads

Source table for EDM preloads

Greenplum (EDM)

Table

ods

treasury_datatape_daily

Target table for daily treasury data

Greenplum (EDM)

View

ods

nls_treasury_datatape_daily_v

View used to load data into treasury_datatape_daily

SQL Server (NLS)

Table

dbo

_ppc_pfr_preloads_filtered_tb

Preloaded NLS data; query uses nolock hint

Attached list of tables used for the view nls_treasury_datatape_daily_v



Object Name

Type

Source Table(s) / Notes

Schema

contract_fact_v

View

ods.xxcon_contract_stage

ods 

payment_schedules_all_fact_v

View

nls_payment_schedule_fact

nls 

ar_cust_trx_fact_v

View

nls_cust_trx_fact

nls 

order_transaction_fact_v

View

order_transaction_fact

(not specified)

account_fact_v

View

ods.xxcon_account_stage

ods 

clientbkpstatus

Table/View

No linked view or table specified

(not specified)

portfolio_current

Table/View

Used as source for portfolio_snapshot_fact_v

 

nls.xxcon_contract_nls

Table

Standalone table

nls

ods.nls_pfr_preloads

Table

Standalone table

ods

 

Task: Treasury_DataTape_Daily
Operator: SSHOperator

Action: Connects to EMR cluster and runs a Jupyter notebook job stored in S3

Command executed:



sh /mnt/usr/local/src/batch/ipynb_trigger/runJob.sh \
   "s3://ppc-edm-prod-ds/studio/e-BLF7HJSHQTMI9GT5SOG7MTU31/Production_Pyspark/exec/ODS/NLS_Daily_DataTape.ipynb"
Timeout: 4 hours (dagrun_timeout=14400)

 Failure Handling
Retries status check up to 25 times (15-minute gap between each)

If still failing:

Clears upstream task (Loop) using airflow tasks clear

Skips downstream execution via AirflowSkipException

Sends failure alert email to: 



datawarehousealerts@purchasingpower.com
datateamnotification@purchasingpower.com
jbedi@purchasingpower.com
ragrawal@purchasingpower.com
pmanning@purchasingpower.com
High-Level Purpose of the Code
Extracts preload data from SQL Server (NLS) and Greenplum (EDM).

Compares the counts, dates, and amounts.

If they match, loads a treasury datatape table in Greenplum.

 

Manual Recovery Step (Run Notebook in Jupyter if DAG Fails)

code path : s3://ppc-edm-prod-ds/studio/e-BLF7HJSHQTMI9GT5SOG7MTU31/Production_Pyspark/exec/ODS/NLS_Daily_DataTape.ipynb

 

1.Connect to SQL Server (NLS):



SELECT count(1) AS cnt, imp_date, sum(preloads) preload_amt 
FROM dbo._ppc_pfr_preloads_filtered_tb 
GROUP BY imp_date;
 

2.Connect to Greenplum (EDM):

 



SELECT count(1) cnt, imp_date, sum(preloads) preload_amt 
FROM ods.nls_pfr_preloads npp 
WHERE imp_date >= current_date 
GROUP BY imp_date 
ORDER BY imp_date DESC;
Compare Results Manually:

Check that cnt, imp_date, and preload_amt are the same in both results.

Load Data to Greenplum if Matching:



INSERT INTO ods.treasury_datatape_daily
SELECT * FROM ods.nls_treasury_datatape_daily_v;
5.Validate:



SELECT COUNT(*) FROM ods.treasury_datatape_daily where as_of_date = (current_date, 1);
 

Execution Flow(pyspark)
Define Helper Functions
GPExecute(query, isolation_level=False)

Connects to Greenplum using psycopg2.

Executes any SQL query provided.

Commits the transaction.

Optional: can set isolation level to 0 (autocommit mode).

data_extract(query)

Uses Spark JDBC to extract data from Greenplum.

Returns a Spark DataFrame.

get_sql_server_cred(system)

Returns credentials for SQL Server if system is "sql".

query_nls(table_or_sql)

Uses Spark JDBC to extract data from SQL Server.

Returns a Spark DataFrame.

 

Extract Data
From NLS (SQL Server):



nls_preload = query_nls("SELECT count(1) AS cnt, imp_date, sum(preloads) preload_amt FROM dbo._ppc_pfr_preloads_filtered_tb (nolock) GROUP BY imp_date")
Aggregates preloads by imp_date.

Returns counts, dates, and total preload amounts.

From EDM (Greenplum):



edm_preload = data_extract("SELECT count(1) cnt, imp_date, sum(preloads) preload_amt FROM ods.nls_pfr_preloads npp WHERE imp_date >= 'now'::text::date GROUP BY 2 ORDER BY 2 DESC")
Aggregates Greenplum preloads from today onwards.

Compare Data
Get the first row from each DataFrame:



nls_row = nls_preload.first()
edm_row = edm_preload.first()
If both rows exist, compare:

cnt (number of records)

imp_date

preload_amt (sum of preloads)

If all match:

Print "Data is matching".

Load data from view into Greenplum table:



GPExecute('INSERT INTO ods.treasury_datatape_daily SELECT * FROM ods.nls_treasury_datatape_daily_v')
Else: print "Data is not matching".

Load Data (Conditional)
Only if the preload counts, dates, and sums match, the script loads the treasury datatape table in Greenplum.


Treasury DataTape Daily – Automated Validation & Self-Healing Enhancement

Overview:

The Treasury DataTape Daily process has been enhanced to include automated, proactive data validation and self-healing capabilities. This improvement addresses previous challenges with manual investigation and delayed resolution of data mismatches between Oracle, Elasticsearch, EDM Greenplum, and the final daily tape.

Automated Data Validation:

Compares record counts and key financial metrics (e.g., sale info) across Oracle source, Elasticsearch, EDM Greenplum, and the daily tape output.

Validates data consistency at each stage, ensuring early detection of mismatches.

 

Self-Healing Logic:

Automatically identifies and remediates common sync issues without manual intervention.

Triggers ES-to-Greenplum data sync and updates the daily tape with missing or corrected records as needed.


Business Impact:

Reduces manual investigation and accelerates issue resolution.

Ensures data consistency across all critical systems before business consumption.

Improves reliability and trust in daily Treasury DataTape outputs.

Function Details
1. data_extract_oracle(query)
Purpose:
Extracts data from the Oracle source system using a provided SQL query.

How it works:
Utilizes Spark’s JDBC connector to securely connect to Oracle, execute the query, and load the results as a Spark DataFrame for further processing.

Usage:
Enables dynamic extraction of contract and sales data for validation against downstream systems.

2. upsert_xxcon_contract_stage()
Purpose:
Ensures the xxcon_contract_stage table in Greenplum is synchronized with the latest data from the staging area.

How it works:

Deletes records in xxcon_contract_stage that match keys in the staging table.

Inserts updated records from the staging table into xxcon_contract_stage.

Uses Python’s psycopg2 library for transactional database operations.

3. upsert_treasury_datatape_daily(order_ids)
Purpose:
Updates the treasury_datatape_daily table in Greenplum with the latest records for specified order IDs.

How it works:

Deletes existing records for the given order_ids and date.

Inserts the latest data from the view nls_treasury_datatape_daily_v.

Ensures only accurate and up-to-date records are present in the daily tape.

4. Validation SQL Logic
Purpose:
Detects mismatches in key financial fields (orderid, soldto, soldamt, soldpool) between Oracle, Greenplum, and Elasticsearch.

How it works:

Runs Spark SQL queries to compare datasets from each system.

Identifies discrepancies and triggers remediation functions as needed.

title: Kafka Connect Auto-Restart Solution

Background
Kafka Connect is a critical component in our data pipeline, responsible for moving large volumes of data between Kafka and external systems such as Oracle databases. Recently, we experienced a network outage that caused Kafka Connect to lose its connection with the Oracle DB. This resulted in data flow interruptions and required manual intervention to restore service by restarting all Kafka connector nodes.

The incident highlighted a gap in our operational resilience: Kafka Connect did not automatically recover from connection failures, leading to increased downtime and manual workload for the support team.

Business Impact
Data Pipeline Disruption: The outage caused delays in data ingestion and processing, impacting downstream analytics and reporting.

Manual Recovery: Siteops and engineering teams had to manually restart Kafka Connect nodes, increasing recovery time and operational overhead.

Risk of Recurrence: Without automated recovery, similar outages could lead to repeated service interruptions and business impact.

Objective
To reduce downtime and manual intervention, we aim to implement an automated solution that monitors Kafka Connect and restarts it if a failure is detected. This will ensure higher availability and reliability of our data integration processes.

Solution Overview

The proposed solution uses a monitoring script that regularly checks the status of the Kafka Connect service on each node. If the service is found to be down or unresponsive, the script attempts to restart it automatically. The solution also includes notification mechanisms to alert the support team about the status and any recovery actions taken.

Key Features
Automated Monitoring: The script periodically checks for the Kafka Connect process using system commands.

Auto-Restart: If the process is not running, the script initiates a restart of Kafka Connect.

Status Verification: After attempting a restart, the script verifies whether Kafka Connect is running successfully.

Email Notifications: The script sends status updates and alerts to designated recipients, including both successful restarts and failures.

Logging: All actions and status checks are logged with timestamps for audit and troubleshooting purposes.

References
DATA-13234: Enable Auto-Restart for Kafka Connectors .

Implementation Details
Script Name: kafka_connect_monitor.sh

Script Location: /home/edmapp/kafka_connect_monitor.sh

Email Notification Script: The monitoring script calls /home/edmapp/send_mail.py to send email alerts when Kafka Connect is restarted or if the restart fails.

How It Works
The monitoring script (kafka_connect_monitor.sh) is scheduled to run at regular intervals (every 1 hour) on each Kafka Connect node.

It checks if the Kafka Connect process (ConnectDistributed) is running.

If the process is not found, the script attempts to restart Kafka Connect.

After the restart attempt, the script verifies if the process is running.

Depending on the result:

If Kafka Connect is successfully restarted, an email notification is sent using send_mail.py to inform Data Engineering Team of the successful recovery.

If the restart fails, an email notification is sent to alert the team that manual intervention is required.

All notifications are handled by the Python script located at /home/edmapp/send_mail.py.

title:MR New Cluster Migration

EMR Cluster Migration – Step-by-Step Guide
1. Clone to New Cluster [Jag]
1.1. Cluster Cloning
Jag to provide detailed steps for cloning the cluster.

1.2. Post-Clone Verification
After cloning, verify that all service versions match the previous cluster. If not, change and modify as needed.

Commands and Sample Outputs:




# Check EMR version
aws emr describe-cluster --cluster-id j-1OSY66HV4C1VN --query "Cluster.ReleaseLabel"
"emr-5.32.0"
# Check PySpark version
python3 -c "import pyspark; print(pyspark.__version__)"
3.4.4
# Check Spark version
spark-submit --version
Welcome to
      ____              __
     / __/__  ___ _____/ /__
    _\ \/ _ \/ _ `/ __/  '_/
   /___/ .__/\_,_/_/ /_/\_\   version 2.4.7-amzn-0
      /_/
Using Scala version 2.11.12, OpenJDK 64-Bit Server VM, 1.8.0_482
...
# Check Python version
python3 --version
Python 3.7.16
# Compare Python packages
pip freeze > pip_new.txt
# (Repeat on old cluster, then diff)
diff pip_new.txt pip_old.txt
# Install missing packages as needed
 

2. Provision ‘aws cli’ [Jag]
Jag to provide details for AWS CLI provisioning.

3. Modify Config for Spark Jobs 
Login to any master node:




cd /usr/local/share/applications/edm-platform/
 

Locate the batch and stream directories.

Each job has a RunJob.sh where memory is defined.

Adjust Spark parameters based on new cluster specs.

Through iterative testing, we have identified the optimal compute configurations to support our specific workloads

Type

Job Name

driverMemory

driverCores

executorCores

executorMemory

numExecutors

batch

edm-mdgp-ap-invoices-fact

8g

1

2

8g

6

batch

edm-mdgp-ar-customer-transaction-fact

8g

1

2

8g

6

batch

edm-mdgp-cash-transaction-fact

8g

1

2

8g

8

batch

edm-mdgp-chubinv-dim

8g

2

2

8g

6

batch

edm-mdgp-client-dim

8g

1

2

8g

6

batch

edm-mdgp-customer-dim

8g

2

2

8g

8

batch

edm-mdgp-dailybalance-snapshot-fact

8g

1

2

8g

6

batch

edm-mdgp-ebs-order-int

8g

2

2

8g

8

batch

edm-mdgp-gl-transaction-fact

8g

1

2

8g

6

batch

edm-mdgp-hybris-order-int

8g

2

2

8g

8

batch

edm-mdgp-kickout-order-log

8g

1

2

8g

6

batch

edm-mdgp-odp_data_log

8g

1

2

8g

6

batch

edm-mdgp-order-return-fact

8g

1

2

8g

6

batch

edm-mdgp-order-return-recon-fact

8g

1

2

8g

6

batch

edm-mdgp-payment-checks-fact

8g

1

2

8g

6

batch

edm-mdgp-payment_schedules_fact

8g

1

2

8g

6

batch

edm-mdgp-portfolio-snapshot-fact

8g

1

2

8g

6

batch

edm-mdgp-product-dim

8g

1

2

8g

6

batch

edm-mdgp-productprice-snapshot

4g

1

2

8g

6

batch

edm-mdgp-prospects-dim

8g

2

2

8g

8

batch

edm-mdgp-stage-EStoGP

8g

1

2

8g

6

batch

edm-mdgp-stage-EStoGP_daily

8g

1

2

8g

6

batch

edm-mdgp-supplier-dim

8g

1

2

8g

6

batch

edm-order-transaction-fact

8g

1

2

8g

6

batch

edm-responsys-fact

8g

1

2

8g

6

stream

edm-ebs-ap-stage

4096m

1

2

5120m

5

stream

edm-ebs-ar-stage

4096m

1

2

5120m

6

stream

edm-ebs-gl-stage

4096m

1

2

5120m

5

stream

edm-ebs-order-stage

4096m

1

2

5120m

5

stream

edm-elig_ind-stage

4096m

1

2

5120m

6

stream

edm-hybris-stage

4096m

1

2

5120m

6

stream

edm-mssql-c4c-stage

4096m

1

2

5120m

5

stream

edm-mt-stage

4096m

1

2

5120m

5

stream

edm-perf-recon-stage

4096m

1

2

5120m

5

The above parameters are actually set for their respective jobs and this helps us to better utilize the resources of the new cluster.

4. Streaming and Batch Job Lineage
4.1. Streaming Job and Related Batch Jobs

The Below table gives a complete picture of the entire lineage from streaming job to the final table / process.

Streaming Job

Kafka Topic

Connector

ES Stage Index

ODS Table

Additional Batch (Airflow DAG -> Spark Job)

edm-ebs-ap-stage

tpc-prodfin-ap-AP_INVOICES_ALL

con-prodfin-ap-ap_invoices_all

es-prodfin-ap-ap_invoices_all_stage

PROD_invoices_gl_fact -> edm-mdgp-ap-invoices-fact

edm-ebs-ap-stage

tpc-prodfin-ap-AP_INVOICE_LINES_ALL

con-prodfin-ap-ap_invoice_lines_all

es-prodfin-ap-ap_invoice_lines_all_stage

PROD_invoices_gl_fact -> edm-mdgp-ap-invoices-fact

edm-ebs-ap-stage

tpc-prodfin-ap-AP_INVOICE_DISTRIBUTIONS_ALL

con-prodfin-ap-ap_invoice_distributions_all

es-prodfin-ap-ap_invoice_distributions_all_stage

PROD_invoices_gl_fact -> edm-mdgp-ap-invoices-fact

edm-ebs-ap-stage

tpc-prodfin-ap-AP_SUPPLIERS

con-prodfin-ap-ap_suppliers

es-prodfin-ap-ap_suppliers_stage

PROD_invoices_gl_fact -> edm-mdgp-ap-invoices-fact

edm-ebs-ap-stage

tpc-prodfin-ap-AP_CHECKS_ALL

con-prodfin-ap-ap_payment_checks

es-prodfin-ap-ap_checks_all_stage

PROD_payment_checks_fact -> edm-mdgp-payment-checks-fact

edm-ebs-ap-stage

tpc-prodfin-ap-AP_INVOICE_PAYMENTS_ALL

con-prodfin-ap-ap_payment_checks

es-prodfin-ap-ap_invoice_payments_all_stage

PROD_invoices_gl_fact -> edm-mdgp-ap-invoices-fact

edm-ebs-ap-stage

tpc-prodfin-supplier_dim

con-prodfin-supplier_dim

es-prodfin-supplier_dim_stage

PROD_supplier_dim -> edm-mdgp-supplier-dim

edm-ebs-ap-stage

tpc-prodfin-potrack-SHIP_COST20240915010239

con-prodfin-potrack-ship_cost

es-prodfin-potrack-ship_cost_stage

edm-ebs-ap-stage

tpc-mt-etl_file_data-RESPONSYS_OPTIN

con-mt-etl_file_data-responsys_group

es-mt-etl_file_data-responsys_optin_stage

responsys_fact

PROD_ODS_responsys_fact -> edm-responsys-fact

edm-ebs-ap-stage

tpc-mt-etl_file_data-RESPONSYS_OPTOUT

con-mt-etl_file_data-responsys_group

es-mt-etl_file_data-responsys_optout_stage

responsys_fact

PROD_ODS_responsys_fact -> edm-responsys-fact

edm-ebs-ap-stage

tpc-mt-etl_file_data-RESPONSYS_PUSHOPENED

con-mt-etl_file_data-responsys_group

es-mt-etl_file_data-responsys_pushopened_stage

responsys_fact

PROD_ODS_responsys_fact -> edm-responsys-fact

edm-ebs-ap-stage

tpc-mt-etl_file_data-RESPONSYS_PUSHOPTIN

con-mt-etl_file_data-responsys_group

es-mt-etl_file_data-responsys_pushoptin_stage

responsys_fact

PROD_ODS_responsys_fact -> edm-responsys-fact

edm-ebs-ap-stage

tpc-mt-etl_file_data-RESPONSYS_PUSHOPTOUT

con-mt-etl_file_data-responsys_group

es-mt-etl_file_data-responsys_pushoptout_stage

responsys_fact

PROD_ODS_responsys_fact -> edm-responsys-fact

edm-ebs-ap-stage

tpc-mt-etl_file_data-RESPONSYS_PUSHSENT

con-mt-etl_file_data-responsys_group

es-mt-etl_file_data-responsys_pushsent_stage

responsys_fact

PROD_ODS_responsys_fact -> edm-responsys-fact

edm-ebs-ap-stage

tpc-mssql_ficodb-cnsmr

con-mssql_ficodb-arsms

es-mssql_ficodb-cnsmr_stage

edm-ebs-ap-stage

tpc-mssql_ficodb-wrkgrp

con-mssql_ficodb-arsms

es-mssql_ficodb-wrkgrp_stage

edm-ebs-ap-stage

tpc-prodmtr-service_middle_tier-CUSTOMER

con-prodmtr-service_middle_tier-customer

es-prodmtr-service_middle_tier-customer_stage

PROD_cust_to_orders -> edm-mdgp-customer-dim

edm-ebs-ap-stage

tpc-rptmt-service_middle_tier-TU_DATA_LOG

con-rptmt-service_middle_tier-tu_data_log

es-rptmt-service_middle_tier-tu_data_log_stage

tu_data_log

edm-ebs-ar-stage

tpc-prodfin-ar-RA_CUSTOMER_TRX_ALL

con-prodfin-ar-ra_customer_trx_all

es-prodfin-ar-ra_customer_trx_all_stage

edm-mdgp-ar-customer-transaction-fact / PROD_NLS_Fact

edm-ebs-ar-stage

tpc-prodfin-ar-RA_CUSTOMER_TRX_LINES_ALL

con-prodfin-ar-ra_customer_trx_lines_all

es-prodfin-ar-ra_customer_trx_lines_all_stage

edm-mdgp-ar-customer-transaction-fact

edm-ebs-ar-stage

tpc-prodfin-ar-RA_CUST_TRX_LINE_GL_DIST_ALL

con-prodfin-ar-ra_cust_trx_line_gl_dist_all

es-prodfin-ar-ra_cust_trx_line_gl_dist_all_stage

edm-mdgp-ar-customer-transaction-fact

edm-ebs-ar-stage

tpc-prodfin-ar-RA_CUST_TRX_TYPES_ALL

con-prodfin-ar-ra_cust_trx_types_all

es-prodfin-ar-ra_cust_trx_types_all_stage

edm-mdgp-ar-customer-transaction-fact

edm-ebs-ar-stage

tpc-prodfin-ar-AR_CASH_RECEIPTS_ALL

con-prodfin-ar-ar_cash_receipts_all

es-prodfin-ar-ar_cash_receipts_all_stage

PROD_Cash_Transaction_Fact -> edm-mdgp-cash-transaction-fact / PROD_NLS_Fact

edm-ebs-ar-stage

tpc-prodfin-ar-AR_RECEIPT_METHODS

con-prodfin-ar-ar_receipt_methods

es-prodfin-ar-ar_receipt_methods_stage

edm-mdgp-cash-transaction-fact

edm-ebs-ar-stage

tpc-prodfin-ar-AR_ADJUSTMENTS_ALL

con-prodfin-ar-ar_adjustments_all

es-prodfin-ar-ar_adjustments_all_stage

edm-mdgp-ar-customer-transaction-fact

edm-ebs-ar-stage

tpc-prodfin-ar-AR_BATCHES_ALL

con-prodfin-ar-ar_batches_all

es-prodfin-ar-ar_batches_all_stage

edm-ebs-ar-stage

tpc-prodfin-xxapps-XX_RETURN_LINE

con-prodfin-xxapps-xx_return_line

es-prodfin-xxapps-xx_return_line_stage

PROD_order_returns_fact -> edm-mdgp-order-return-fact

edm-ebs-ar-stage

tpc-fprod-purchasingpower-PPCRETURNENTRYLABELS

con-fprod-replica_inc_group

es-fprod-purchasingpower-ppcreturnentrylabels_stage

edm-mdgp-order-return-fact

edm-ebs-ar-stage

tpc-rptmt-purchasingpower-PRODUCTFEATURES

con-rptmt-smt-asl

es-rptmt-purchasingpower-productfeatures_stage

edm-ebs-ar-stage

tpc-mssql_nls-dbo-PPC_PFR_PRELOADS_FILTERED_TB

con-mssqlsrvr-nls-preloads_inc_fb

es-mssqlsrvr-nls-ppc_pfr_preloads_filtered_tb_stage

nls_pfr_preloads

PROD_NLS_Fact

edm-ebs-ar-stage

tpc-pdhybris-purchasingpower-PPCCUSTOMERNOTE

con-pdhybris-replica_inc_group

es-pdhybris-purchasingpower-ppccustomernote_stage

edm-ebs-ar-stage

tpc-pdhybris-purchasingpower-STOCKLEVELS

con-pdhybris-purchasingpower-stocklevels

es-pdhybris-purchasingpower-stocklevels_stage

stocklevels_stage

edm-ebs-gl-stage

tpc-prodfin-gl-GL_JE_BATCHES

con-prodfin-gl-gl_je_batches

es-prodfin-gl-gl_je_batches_stage

PROD_invoices_gl_fact -> edm-mdgp-gl-transaction-fact

edm-ebs-gl-stage

tpc-prodfin-gl-GL_JE_HEADERS

con-prodfin-gl-gl_je_headers

es-prodfin-gl-gl_je_headers_stage

PROD_invoices_gl_fact -> edm-mdgp-gl-transaction-fact

edm-ebs-gl-stage

tpc-prodfin-gl-GL_JE_LINES

con-prodfin-gl-gl_je_lines

es-prodfin-gl-gl_je_lines_stage

PROD_invoices_gl_fact -> edm-mdgp-gl-transaction-fact

edm-ebs-gl-stage

tpc-prodfin-gl-GL_CODE_COMBINATIONS

con-prodfin-gl-gl_code_combinations

es-prodfin-gl-gl_code_combinations_stage

PROD_invoices_gl_fact -> edm-mdgp-gl-transaction-fact

edm-ebs-gl-stage

tpc-prodfin-ar-AR_RECEIVABLE_APPLICATIONS_ALL

con-prodfin-ar-ar_receivable_applications_all

es-prodfin-ar-ar_receivable_applications_all_stage

edm-mdgp-ar-customer-transaction-fact

edm-ebs-gl-stage

tpc-prodfin-ar-AR_PAYMENT_SCHEDULES_ALL

con-prodfin-ar-ar_payment_schedules_all

es-prodfin-ar-ar_payment_schedules_all_stage

edm-mdgp-payment_schedules_fact / PROD_NLS_Fact

edm-ebs-gl-stage

tpc-prodfin-xxapps-XX_DAILY_PRELOAD

con-prodfin-xxapps-xx_daily_preload

es-prodfin-xxapps-xx_daily_preload_stage

xx_daily_preload

edm-ebs-gl-stage

tpc-prodfin-xxcontract-XX_DAILY_CONTRACT_PRELOAD

con-prodfin-xxcontract-xx_daily_contract_preload

es-prodfin-xxcontract-xx_daily_contract_preload_stage

xx_daily_contract_preload

edm-ebs-gl-stage

tpc-prodmtr-sms-AR_SMS_EVENT_LOGS

con-prodmtr-sms-ar_sms_event_logs

es-prodmtr-sms-ar_sms_event_logs_stage

ar_sms_event_logs

PROD_AR_SMS

edm-ebs-gl-stage

tpc-prodmtr-service_middle_tier-CUST_CREDIT_LIMIT_AUDIT

con-prodmtr-service_middle_tier-cust_credit_limit_audit

es-prodmtr-service_middle_tier-cust_credit_limit_audit_stage

cust_credit_limit_audit

edm-ebs-order-stage

tpc-prodfin-ont-OE_ORDER_HEADERS_ALL

con-prodfin-ont-oe_order_headers_all

es-prodfin-ont-oe_order_headers_all_stage

PROD_cust_to_orders -> edm-mdgp-ebs-order-int / edm-mdgp-order-return-fact

edm-ebs-order-stage

tpc-prodfin-ont-OE_ORDER_LINES_ALL

con-prodfin-ont-oe_order_lines_all

es-prodfin-ont-oe_order_lines_all_stage

PROD_cust_to_orders -> edm-mdgp-ebs-order-int

edm-ebs-order-stage

tpc-prodfin-ont-OE_DROP_SHIP_SOURCES

con-prodfin-ont-oe_drop_ship_sources

es-prodfin-ont-oe_drop_ship_sources_stage

edm-mdgp-ebs-order-int

edm-ebs-order-stage

tpc-prodfin-ont-OE_TRANSACTION_TYPES_TL

(inferred)

es-prodfin-ont-oe_transaction_types_tl_stage

edm-mdgp-ebs-order-int

edm-ebs-order-stage

tpc-prodfin-xxapps-XX_RETURN_TRX

con-prodfin-xxapps-xx_return_trx

es-prodfin-xxapps-xx_return_trx_stage

PROD_order_returns_fact -> edm-mdgp-order-return-fact

edm-ebs-order-stage

tpc-prodfin-xxapps-XX_RETURN_CART_LINE

con-prodfin-xxapps-xx_return_cart_line

es-prodfin-xxapps-xx_return_cart_line_stage

edm-mdgp-order-return-fact

edm-ebs-order-stage

tpc-prodfin-inv-MTL_SYSTEM_ITEMS_B

con-prodfin-inv-mtl_system_items_b

es-prodfin-inv-mtl_system_items_b_stage

PROD_product_dim -> edm-mdgp-product-dim

edm-ebs-order-stage

tpc-prodfin-apps-XX_SUBCLASS_NAME

con-prodfin-apps-xx_subclass_name

es-prodfin-apps-xx_subclass_name_stage

PROD_product_dim -> edm-mdgp-product-dim

edm-ebs-order-stage

tpc-prodfin-po-PO_HEADERS_ALL

con-prodfin-po-po_headers_all

es-prodfin-po-po_headers_all_stage

edm-mdgp-ebs-order-int

edm-ebs-order-stage

tpc-prodfin-po-PO_LINES_ALL

con-prodfin-po-po_line_all

es-prodfin-po-po_lines_all_stage

edm-mdgp-ebs-order-int

edm-ebs-order-stage

tpc-prodfin-po-PO_LINE_LOCATIONS_ALL

con-prodfin-po-po_line_locations_all

es-prodfin-po-po_line_locations_all_stage

edm-mdgp-ebs-order-int

edm-ebs-order-stage

tpc-prodfin-po-PO_DISTRIBUTIONS_ALL

con-prodfin-po-po_distributions_all

es-prodfin-po-po_distributions_all_stage

edm-mdgp-ebs-order-int

edm-ebs-order-stage

tpc-prodfin-po-PO_REQUISITION_LINES_ALL

con-prodfin-po-po_requisition_lines_all

es-prodfin-po-po_requisition_lines_all_stage

edm-mdgp-ebs-order-int

edm-ebs-order-stage

tpc-prodfin-applsys-FND_FLEX_VALUE_SETS

(inferred)

es-prodfin-applsys-fnd_flex_value_sets_stage

edm-mdgp-product-dim

edm-ebs-order-stage

tpc-prodfin-applsys-FND_FLEX_VALUES

(inferred)

es-prodfin-applsys-fnd_flex_values_stage

edm-mdgp-product-dim

edm-ebs-order-stage

tpc-prodfin-applsys-FND_FLEX_VALUES_TL

(inferred)

es-prodfin-applsys-fnd_flex_values_tl_stage

edm-mdgp-product-dim

edm-ebs-order-stage

tpc-prodfin-potrack-XX_ORDER_EVENTS

con-prodfin-potrack-xx_order_events

es-prodfin-potrack-xx_order_events_stage

xx_order_events_stage

edm-ebs-order-stage

tpc-prodfin-potrack-XX_OPT_RMA_RECEIPT

con-prodfin-potrack-xx_opt_transactions

es-prodfin-potrack-xx_opt_rma_receipt_stage

edm-mdgp-order-return-fact

edm-ebs-order-stage

tpc-prodfin-xxhost-XXPMT_CALENDAR

(inferred)

es-prodfin-xxhost-xxpmt_calendar_stage

edm-ebs-order-stage

tpc-prodfin-xxcontract-ORDER_ERRORS

con-prodfin-xxcontract-order_errors

es-prodfin-xxcontract-order_errors_stage

order_errors

edm-elig_ind-stage

tpc-mt-etl_mft-ELIGIBILITY

con-mt-etl_mft-eligibility

es-mt-etl_mft-eligibility_stage

PROD_client_dim -> edm-mdgp-client-dim

edm-elig_ind-stage

tpc-mt-etl_mft-ELIG_IND_2

con-mt-etl_mft-elig_ind

es-mt-etl_mft-elig_ind_2_stage

PROD_client_dim -> edm-mdgp-client-dim

edm-elig_ind-stage

tpc-mt-orbit-ELIG_AUDIT

con-mt-orbit-elig_audit

es-mt-orbit-elig_audit_stage

elig_audit_stage

PROD_client_dim -> edm-mdgp-client-dim

edm-elig_ind-stage

tpc-mt-etl_file_data-CHUB_INV

(inferred)

es-mt-etl_file_data-chub_inv_stage

PROD_chub_inv -> edm-mdgp-chubinv-dim

edm-elig_ind-stage

tpc-prdetl-etl_filedata-ACCERTIFY_ORDERS

con-prdetl-etl_filedata-accertify

es-prdetl-etl_file_data-accertify_orders_stage

accertify_orders

edm-elig_ind-stage

tpc-prdetl-etl_file_data-OF54_DATA

(inferred)

es-prdetl-etl_file_data-of54_data_stage

edm-elig_ind-stage

tpc-prdetl-etl_file_data-SPI_POR

(inferred)

es-prdetl-etl_file_data-spi_por_stage

edm-elig_ind-stage

tpc-prdetl-etl_file_data-NSD_INVOICE

(inferred)

es-prdetl-etl_file_data-nsd_invoice_stage

nsd_invoice_stage

edm-elig_ind-stage

tpc-prdetl-etl_file_data-UPS_INVOICE

(inferred)

es-prdetl-etl_file_data-ups_invoice_stage

ups_invoice_stage

edm-hybris-stage

tpc-fprod-purchasingpower-ORDERS

con-fprod-replica_inc_group

es-fprod-purchasingpower-orders_stage

PROD_cust_to_orders -> edm-mdgp-hybris-order-int

edm-hybris-stage

tpc-fprod-purchasingpower-ORDERENTRIES

con-fprod-replica_inc_group

es-fprod-purchasingpower-orderentries_stage

PROD_cust_to_orders -> edm-mdgp-hybris-order-int

edm-hybris-stage

tpc-fprod-purchasingpower-MT_ORDER_ITEM_V

con-fprod-purchasingpower-mt_order_item_view

es-fprod-purchasingpower-mt_order_item_v_stage

PROD_cust_to_orders -> edm-mdgp-hybris-order-int

edm-hybris-stage

tpc-fprod-purchasingpower-ORDERPROCESSORREPORT

con-fprod-replica_inc_group

es-fprod-purchasingpower-orderprocessorreport_stage

edm-mdgp-hybris-order-int

edm-hybris-stage

tpc-fprod-purchasingpower-PPCREQUESTRETURNENTRY

con-fprod-replica_inc_group

es-fprod-purchasingpower-ppcrequestreturnentry_stage

edm-mdgp-order-return-fact

edm-hybris-stage

tpc-fprod-purchasingpower-PRODUCTS

con-fprod-replica-products

es-fprod-purchasingpower-products_stage

PROD_product_dim -> edm-mdgp-product-dim

edm-hybris-stage

tpc-fprod-purchasingpower-PRODUCTREFERENCES

con-fprod-replica_inc_group

es-fprod-purchasingpower-productreferences_stage

edm-mdgp-product-dim

edm-hybris-stage

tpc-fprod-purchasingpower-PRICEROWS

con-fprod-replica_inc_group

es-fprod-purchasingpower-pricerows_stage

PROD_product_dim -> edm-mdgp-productprice-snapshot

edm-hybris-stage

tpc-fprod-purchasingpower-WARRANTYDETAILS

con-fprod-replica_inc_group

es-fprod-purchasingpower-warrantydetails_stage

edm-mdgp-product-dim

edm-hybris-stage

tpc-fprod-purchasingpower-WARRANTYCATEGORY

con-fprod-replica_inc_group

es-fprod-purchasingpower-warrantycategory_stage

edm-mdgp-product-dim

edm-hybris-stage

tpc-fprod-purchasingpower-ENUMERATIONVALUES

con-fprod-replica_inc_group

es-fprod-purchasingpower-enumerationvalues_stage

enumerationvalues

edm-mdgp-product-dim

edm-hybris-stage

tpc-fprod-purchasingpower-UNITS

con-fprod-replica_inc_group

es-fprod-purchasingpower-units_stage

edm-hybris-stage

tpc-fprod-purchasingpower-DEPARTMENT

con-fprod-replica_inc_group

es-fprod-purchasingpower-department_stage

edm-hybris-stage

tpc-fprod-purchasingpower-CURRENCIES

con-fprod-replica_inc_group

es-fprod-purchasingpower-currencies_stage

edm-hybris-stage

tpc-fprod-purchasingpower-DEDUCTIONTYPE

con-fprod-replica_inc_group

es-fprod-purchasingpower-deductiontype_stage

edm-hybris-stage

tpc-fprod-purchasingpower-CATALOGS

con-fprod-replica_inc_group

es-fprod-purchasingpower-catalogs_stage

edm-mdgp-product-dim

edm-hybris-stage

tpc-fprod-purchasingpower-CATALOGVERSIONS

con-fprod-replica_inc_group

es-fprod-purchasingpower-catalogversions_stage

edm-mdgp-product-dim

edm-hybris-stage

tpc-fprod-purchasingpower-PPCBRAND

con-fprod-replica_inc_group

es-fprod-purchasingpower-ppcbrand_stage

edm-mdgp-product-dim

edm-hybris-stage

tpc-fprod-purchasingpower-PPCCLIENT

con-fprod-purchasingpower-inc_low_group

es-fprod-purchasingpower-ppcclient_stage

PROD_client_dim -> edm-mdgp-client-dim

edm-hybris-stage

tpc-fprod-purchasingpower-USERS

con-fprod-replica_inc_group

es-fprod-purchasingpower-users_stage

PROD_cust_to_orders -> edm-mdgp-customer-dim

edm-hybris-stage

tpc-fprod-purchasingpower-ADDRESSES

con-fprod-replica_inc_group

es-fprod-purchasingpower-addresses_stage

edm-mdgp-customer-dim

edm-hybris-stage

tpc-fprod-purchasingpower-CARTS

con-fprod-replica_inc_group

es-fprod-purchasingpower-carts_stage

edm-hybris-stage

tpc-fprod-purchasingpower-CARTENTRIES

con-fprod-replica_inc_group

es-fprod-purchasingpower-cartentries_stage

edm-hybris-stage

tpc-fprod-purchasingpower-WISHLIST2

con-fprod-replica_inc_group

es-fprod-purchasingpower-wishlist2_stage

edm-hybris-stage

tpc-fprod-purchasingpower-WISHLIST2ENTRY

con-fprod-replica_inc_group

es-fprod-purchasingpower-wishlist2entry_stage

edm-hybris-stage

tpc-fprod-purchasingpower-REGIONS

con-fprod-replica_inc_group

es-fprod-purchasingpower-regions_stage

edm-hybris-stage

tpc-fprod-purchasingpower-PPCVENDORENTRIES

con-fprod-replica_inc_group

es-fprod-purchasingpower-ppcvendorentries_stage

edm-hybris-stage

tpc-fprod-purchasingpower-CARRIERDETAIL

con-fprod-replica_inc_group

es-fprod-purchasingpower-carrierdetail_stage

edm-hybris-stage

tpc-fprod-purchasingpower-CARRIERDETAILLP

con-fprod-replica_inc_group

es-fprod-purchasingpower-carrierdetaillp_stage

edm-hybris-stage

tpc-fprod-purchasingpower-REWARDHISTORYENTRIES

con-fprod-replica_inc_group

es-fprod-purchasingpower-rewardhistoryentries_stage

rewardhistoryentries_stage

edm-hybris-stage

tpc-rptmt-smt-ASL_SCHEMA_CLIENT

con-rptmt-smt-asl

es-rptmt-smt-asl_schema_client_stage

asl_schema_client_stage

PROD_client_dim -> edm-mdgp-client-dim

edm-hybris-stage

tpc-rptmt-smt-ASL_VIP_BUMP

con-rptmt-smt-asl

es-rptmt-smt-asl_vip_bump_stage

asl_vip_bump_stage

edm-hybris-stage

tpc-rptmt-smt-ASL_SCHEMA_RULES

con-rptmt-smt-asl

es-rptmt-smt-asl_schema_rules_stage

asl_schema_rules_stage

edm-hybris-stage

tpc-rptmt-analytics_dwh-MART_DEMAND_LTWT

(inferred)

es-rptmt-analytics_dwh-mart_demand_ltwt_stage

edm-hybris-stage

tpc-rptmt-etl_rsys-CIT

con-rptmt-etl_rsys-cit

es-rptmt-etl_rsys-cit_stage

PROD_client_dim -> edm-mdgp-client-dim

edm-hybris-stage

tpc-etl-etl_file_data-IBEX_CALLCENTER

con-etl_ibex_callcenter

es-etl-etl_file_data-ibex_callcenter_stage

ibex_callcenter_stage

edm-hybris-stage

tpc-etl-etl_file_data-CALLCENTER

con-etl-etl_file_data_callcenter

es-etl-etl_file_data-callcenter_stage

callcenter_stage

edm-mssql-c4c-stage

tpc-mssql_c4c-dbo-c4c_servicerequest_new

con-mssql_c4c-dbo-c4c_servicerequest_new

es-mssql_c4c-dbo-c4c_servicerequest_new_stage

c4c_servicerequest_new_stage

edm-mssql-c4c-stage

tpc-mssql_c4c-dbo-c4c_servicerequest_Custom

con-mssql_c4c-dbo-c4c_servicerequest_custom

es-mssql_c4c-dbo-c4c_servicerequest_custom_stage

c4c_servicerequest_custom_stage

edm-mssql-c4c-stage

tpc-rptmt-app_support-C4C_TICKETCHANGES

(inferred)

es-rptmt-app_support-c4c_ticketchanges_stage

c4c_ticketchanges_stage

edm-mssql-c4c-stage

tpc-pdhybris-purchasingpower-CAT2PRODREL

con-pdhybris-replica_inc_group

es-pdhybris-purchasingpower-cat2prodrel_stage

cat2prodrel

edm-mdgp-product-dim

edm-mssql-c4c-stage

tpc-pdhybris-purchasingpower-CATEGORIES

con-pdhybris-replica_inc_group

es-pdhybris-purchasingpower-categories_stage

categories

PROD_product_dim -> edm-mdgp-product-dim

edm-mssql-c4c-stage

tpc-pdhybris-purchasingpower-PAYMENTINFOS

con-pdhybris-replica_inc_group

es-pdhybris-purchasingpower-paymentinfos_stage

paymentinfos

edm-mssql-c4c-stage

tpc-pdhybris-purchasingpower-PROD2BUNDLEPRODREL

con-pdhybris-replica_inc_group

es-pdhybris-purchasingpower-prod2bundleprodrel_stage

edm-mdgp-product-dim

edm-mssql-c4c-stage

tpc-pdhybris-purchasingpower-PRODUCTSLP

con-pdhybris-replica_inc_group

es-pdhybris-purchasingpower-productslp_stage

edm-mdgp-product-dim

edm-mssql-c4c-stage

tpc-pdhybris-purchasingpower-SHIPMENTBOX

con-pdhybris-replica_inc_group

es-pdhybris-purchasingpower-shipmentbox_stage

shipmentbox_stage

edm-mssql-c4c-stage

tpc-prodmtr-service_middle_tier-CUSTOMERSEGMENT

con-mt-service_middle_tier-customersegment

es-prodmtr-service_middle_tier-customersegment_stage

customer_segment

edm-mdgp-customer-dim

edm-mssql-c4c-stage

tpc-rptmt-purchasingpower-LOGENTRIES

(inferred)

es-rptmt-purchasingpower-logentries_stage

edm-mssql-c4c-stage

tpc-fprod-purchasingpower-ORDERMODIFIRECORDS

con-fprod-replica_inc_group

es-fprod-purchasingpower-ordermodifirecords_stage

edm-mssql-c4c-stage

tpc-fprod-purchasingpower-ORDERMODIFIRECENTRS

con-fprod-replica_inc_group

es-fprod-purchasingpower-ordermodifirecentrs_stage

edm-mssql-c4c-stage

tpc-fprod-purchasingpower-PROCESSSTAGE

con-fprod-replica_inc_group

es-fprod-purchasingpower-processstage_stage

edm-mssql-c4c-stage

tpc-fprod-purchasingpower-KICKOUTREASON

con-fprod-replica_inc_group

es-fprod-purchasingpower-kickoutreason_stage

ODS_kickout_order_log -> edm-mdgp-kickout-order-log

edm-mssql-c4c-stage

tpc-fprod-purchasingpower-CUSTOMERDOCUMENT

con-fprod-replica_inc_group

es-fprod-purchasingpower-customerdocument_stage

edm-mssql-c4c-stage

tpc-fprod-purchasingpower-CLIENT2CUSTDOCSREL

con-fprod-replica_inc_group

es-fprod-purchasingpower-client2custdocsrel_stage

edm-mssql-c4c-stage

tpc-prodmtr-odp-MESSAGE_NOTE

(inferred)

es-prodmtr-odp-message_note_stage

odp_data_log

PROD_odp_data_log -> edm-mdgp-odp_data_log

edm-mssql-c4c-stage

tpc-prodmtr-odp-FILE_QUEUE

(inferred)

es-prodmtr-odp-file_queue_stage

odp_data_log

PROD_odp_data_log -> edm-mdgp-odp_data_log

edm-mssql-c4c-stage

tpc-prodfin-hist-potrack-XX_ORDER_EVENTS

(historical)

es-prodfin-potrack-xx_order_events_stage

xx_order_events_stage

edm-mt-stage

tpc-prodmtr-service_middle_tier-ORDER_HEADER

con-prodmtr-service_middle_tier-order_group

es-prodmtr-service_middle_tier-order_header_stage

order_header_stage

PROD_cust_to_orders -> edm-mdgp-hybris-order-int / edm-mdgp-ebs-order-int

edm-mt-stage

tpc-prodmtr-service_middle_tier-ORDER_ITEM

con-prodmtr-service_middle_tier-order_activity

es-prodmtr-service_middle_tier-order_item_stage

edm-mdgp-hybris-order-int

edm-mt-stage

tpc-prodmtr-service_middle_tier-ORDER_ACTIVITY

con-prodmtr-service_middle_tier-order_activity

es-prodmtr-service_middle_tier-order_activity_stage

edm-mdgp-hybris-order-int

edm-mt-stage

tpc-prodmtr-service_middle_tier-ATOMIC_DATA_LOG

con-prodmtr-service_middle_tier-atomic_group

es-prodmtr-service_middle_tier-atomic_data_log_stage

atomic_data_log_stage

edm-mt-stage

tpc-prodmtr-service_middle_tier-ATOMIC_DEPOSIT_DETAILS

con-prodmtr-service_middle_tier-atomic_group

es-prodmtr-service_middle_tier-atomic_deposit_details_stage

atomic_deposit_details_stage

edm-mt-stage

tpc-prodmtr-service_middle_tier-CART_AUDIT

con-prodmtr-service_middle_tier-cart_audit

es-prodmtr-service_middle_tier-cart_audit_stage

cart_audit_stage

edm-mt-stage

tpc-mt-service_middle_tier-CUSTOMER

con-prodmtr-service_middle_tier-customer

es-mt-service_middle_tier-customer_stage

PROD_cust_to_orders -> edm-mdgp-customer-dim

edm-mt-stage

tpc-mt-etl_mft-ANALYTICS

con-mt-etl_mft-analytics

es-mt-etl_mft-analytics_stage

analytics_stage

edm-mt-stage

tpc-mt-etl_mft-PPC_TIME_DIMENSION

con-mt-etl_mft-ppc_time_dimension

es-mt-etl_mft-ppc_time_dimension_stage

edm-mt-stage

tpc-mt-etl_file_data-SKUUUDLE_MATCH_DATA

(inferred)

es-mt-etl_file_data-skuuudle_match_data_stage

skuuudle_match_data_stage

edm-mt-stage

tpc-mt-etl_file_data-PPCSELECT_INVITE_LIST

con-mt-etl_file_data-ppcselect_invite_list

es-mt-etl_file_data-ppcselect_invite_list_stage

ppcselect_invite_list

edm-mt-stage

tpc-mt-etl_file_data-CHUB_INVOICE

(inferred)

es-mt-etl_file_data-chub_invoice_stage

PROD_chub_inv -> edm-mdgp-chubinv-dim

edm-mt-stage

tpc-mt-etl_file_data-CHUB_INVADJ

(inferred)

es-mt-etl_file_data-chub_invadj_stage

PROD_chub_inv -> edm-mdgp-chubinv-dim

edm-mt-stage

tpc-mt-etl_file_data-CHUB_RETURN

(inferred)

es-mt-etl_file_data-chub_return_stage

edm-mt-stage

tpc-mt-etl_file_data-CHUB_CREDIT_EXCEP

(inferred)

es-mt-etl_file_data-chub_credit_excep_stage

edm-mt-stage

tpc-mt-etl_file_data-CLOUDBLUE_ASSETFEED

(inferred)

es-mt-etl_file_data-cloudblue_assetfeed_stage

edm-mt-stage

tpc-mt-etl_file_data-CLOUDBLUE_SHIPPEDASSETS

(inferred)

es-mt-etl_file_data-cloudblue_shippedassets_stage

edm-mt-stage

tpc-mt-etl_file_data-CLOUDBLUE_VENDORDISPOSITION

(inferred)

es-mt-etl_file_data-cloudblue_vendordisposition_stage

edm-mt-stage

tpc-prdetl-etl_file_data-OPTORO_TRANSACTIONS

con-prdetl-etl_file_data-optoro_transactions

es-prdetl-etl_file_data-optoro_transactions_stage

edm-mt-stage

tpc-prdetl-etl_file_data-OPTORO_ON_HAND_UNITS

con-prdetl-etl_file_data-optoro_on_hand_units

es-prdetl-etl_file_data-optoro_on_hand_units_stage

edm-mt-stage

tpc-prdetl-etl_file_data-OPTORO_UNITS_RECEIVED

con-prdetl-etl_file_data-optoro_units_received

es-prdetl-etl_file_data-optoro_units_received_stage

edm-mt-stage

tpc-prdetl-etl_file_data-OPTORO_FINAL_DISPOS

con-prdetl-etl_file_data-optoro

es-prdetl-etl_file_data-optoro_final_dispos_stage

edm-mt-stage

tpc-prdetl-etl_file_data-OPTORO_RMA_RECEIPT

con-prdetl-etl_file_data-optoro

es-prdetl-etl_file_data-optoro_rma_receipt_stage

edm-mt-stage

tpc-prodfin-potrack-XX_OPT_TRANSACTIONS

con-prodfin-potrack-xx_opt_transactions

es-prodfin-potrack-xx_opt_transactions_stage

edm-mt-stage

tpc-prdetl-etl_file_data-UPS_QVD

(inferred)

es-prdetl-etl_file_data-ups_qvd_stage

ups_qvd_stage

edm-mt-stage

tpc-rptmt-acollum-SHIP_COST

(inferred)

es-rptmt-acollum-ship_cost_stage

edm-perf-recon-stage

tpc-prodfin-xxcontract-XXCON_CONTRACT

con-prodfin-xxcontract-xxcon_contract_incremental

es-prodfin-xxcontract-xxcon_contract_stage

xxcon_contract_stage

edm-mdgp-payment_schedules_fact

edm-perf-recon-stage

tpc-prodfin-xxcontract-XXCON_ACCOUNT

con-prodfin-xxcontract-xxcon_account

es-prodfin-xxcontract-xxcon_account_stage

xxcon_account_stage

edm-mdgp-payment_schedules_fact

edm-perf-recon-stage

tpc-prodfin-ar-AR_CASH_RECEIPT_HISTORY_ALL

con-prodfin-ar-ar_cash_receipt_history_all

es-prodfin-ar-ar_cash_receipt_history_all_stage

PROD_Cash_Transaction_Fact -> edm-mdgp-cash-transaction-fact / PROD_NLS_Fact

edm-perf-recon-stage

tpc-prodfin-potrack-XX_CARRIER_DTL

con-prodfin-potrack-xx_carrier_dtl

es-prodfin-potrack-xx_carrier_dtl_stage

carrier_details_stage

edm-perf-recon-stage

tpc-mt-service_middle_tier-STRIPE_DATA_LOG

con-mt-service_middle_tier-stripe_data_log

es-mt-service_middle_tier-stripe_data_log_stage

stripe_data_log_stage

edm-perf-recon-stage

tpc-mt-purchasingpower-GENERICITEMS

con-mt-purchasingpower-genericitem

es-mt-etl_file_data-genericitems_stage

genericitems

PROD_product_dim -> edm-mdgp-product-dim

edm-perf-recon-stage

tpc-prodmtr-service_middle_tier-EVS_DATA_LOG

(inferred)

es-prodmtr-service_middle_tier-evs_data_log_stage

evs_data_log

edm-perf-recon-stage

tpc-mt-etl_file_data-FLASH_SALE_DATA

(inferred)

es-mt-etl_file_data-flash_sale_data_stage

flash_sale_data

5. Migrate to Airflow and Finalize 
Kill all streaming and batch jobs on the old cluster.

Stop the streaming job restart in Airflow.

Update Airflow to use the new master node IP.

Restart streaming jobs from Airflow using the stream job restart.

title: SOP – Forecast & Budget File Update (Annual Process)
Purpose

This SOP defines the standard process for annual update of Forecast and Budget files received in January (first week), including file renaming, S3 upload and validation in EDM.

Scope

This SOP applies to:

Annual Forecast and Budget file refresh

S3 external file replacement

EDM tables:

democratize.fin_budget

democratize.fin_forecast_stg

This activity is performed once every year in January.

Background

New Budget and Forecast files are received only for the current year during the first week of January

EDM tables expect standardized file names and locations

Budget and Forecast files must always be in sync (same record count and demand) during the first month of the year.

Tables & File Locations

4.1 EDM Tables

democratize.fin_budget

democratize.fin_forecast_stg

4.2 S3 File Locations

Plain Text

s3://s3-external-1.amazonaws.com/ppc-edm-gp-externaldataset/edm-reporting/

File Type

Expected File Name

Budget

2021_fin_budget_stg.csv

Forecast

fin_forecast_stg.csv

Annual Execution Timeline

Frequency: Once per year

Execution Window: First week of January

Trigger: Receipt of new Forecast & Budget files

Annual Update Procedure

Step 1: Receive New Files

Obtain current-year Budget and Forecast files from Ticket

Confirm:

Files are complete

No header/schema changes

Step 2: Rename Files as Per EDM Standards

Rename files exactly as below:

Budget File - 2021_fin_budget_stg.csv

Forecast File - fin_forecast_stg.csv

 

⚠️ File names must match EDM expectations. Any mismatch will cause loading issues.

Step 3: Upload Files to S3

Upload the renamed files to:

s3://s3-external-1.amazonaws.com/ppc-edm-gp-externaldataset/edm-reporting/

Confirm:

Old files are replaced

Upload is successful

File size is non‑zero

Step 4: External Table Refresh

Ensure external tables are pointing to the correct files

No DDL changes required if file structure remains unchanged

Validation

7.1 Row Count & Demand Validation

Run the following validation query:

SQL

select 'fin_budget' as table_name,

count(1) as row_count,

sum(demand) as total_demand

from democratize.fin_budget

 

union all

 

select 'fin_forecast_stg' as table_name,

count(1) as row_count,

sum(demand) as total_demand

from democratize.fin_forecast_stg;

 

7.2 Expected Result

✅ Row count must be equal for both tables

✅ Total demand must be equal for both tables

Error Handling

If validation fails:

Verify:

File naming

Upload location

Year update logic

Re‑upload corrected files

Re‑run validation

Dependencies & Assumptions

Forecast and Budget files are delivered on time

File schema remains unchanged year over year

S3 credentials and external table access are valid

 

 

 

10. Ownership & Responsibility

Role

Responsibility

Data Engineering

File renaming, S3 upload, table refresh

Data Validation

Row count and demand validation

Business

Sign‑off on demand numbers

 

Important Note:

Every year on 01‑Jan, the previous forecast file must be updated by incrementing the year by +1 because the new files will be received during first/second week of January.

Examples:

2025 → 2026

2026 → 2027

Ensure:

All forecast periods reflect the updated year

No overlap with previous-year forecast periods

title:Run Book to Setup a New cluster from existing Backups
Steps:

·         Login to the new Master Server via putty using Hadoop user (Current Clusters Master : 10.175.50.191)

·         Run the below commands

 

##Run book for create a  new EMR in case if needed.

 

#!/bin/bash

## Attach this volume to the master in /usr/local/share/applications

## Recreating the files from backup

mkdir /mnt/usr/

mkdir /mnt/usr/local/

mkdir /mnt/usr/local/src

aws s3 cp s3://ppc-edm-cicd/Backup/ip-10-175-50-186/pyspark/src/ /mnt/usr/local/src/ --recursive

sudo aws s3 cp s3://ppc-edm-cicd/Backup/ip-10-175-50-186/scala/ /usr/local/ --recursive

sudo chown -R hadoop /usr/local/share/applications/

sudo chown -R hadoop /mnt/usr/local/src/

sudo chmod 755 -R /mnt/usr/local/src/*

### installing pip libs

sudo python3 -m pip install --upgrade pip

sudo python3 -m pip install --upgrade setuptools

sudo python3 -m pip install botocore pandas==1.2.3 boto3 ujson warcio lxml PyJWT==1.7.1  SQLAlchemy==1.3.23  configparser  matplotlib   tensorflow   seaborn    scikit-learn   sklearn   awswrangler==2.7.0  beautifulsoup4==4.9.1  nltk==3.5  zipp==3.6.0 fastavro==1.4.4 psycopg2==2.7.7 psycopg2-binary==2.9.2 lp-api-wrapper python-snappy==0.6.0 xgboost==1.4.2

sudo python3 -m pip install numpy --upgrade --ignore-installed

### Requested by DEET-6634

sudo python3 -m pip install selenium xlsxwriter xlwings

### installing postgre sql

sudo yum install postgresql -y

## Requested by ninder -- DWH-52

## for Pyspark

sudo amazon-linux-extras install epel -y

sudo yum install s3fs-fuse -y

sudo python3 -m pip install emr-notebooks-magics==0.1 smart_open

sudo python3 -m pip install s3fs

sudo python3 -m pip install fsspec

sudo python3 -m pip install psutil

sudo python3 -m pip install xlrd

sudo python3 -m pip install openpyxl

sudo python3 -m pip install boto

sudo python3 -m pip install plotly

## for Python

#pip install sklearn

#pip install awswrangler

#pip install emr-notebooks-magics==0.1 smart_open

#pip install s3fs

#pip install fsspec

#pip install psutil

#pip install xlrd

#pip install openpyxl

#pip install boto

#pip install plotly

sudo python3 -m pip install tableauserverclient tableauhyperapi tableau-api-lib

sudo python3 -m pip install nbconvert jupyter

sudo python3 -m pip install psycopg2

sudo python3 -m pip install pyhocon

sudo python3 -m pip install sqlalchemy

sudo python3 -m pip install jwt

sudo python3 -m pip install "urllib3<2.0"

 

#sudo python3 -m pip install git+https://github.com/cliangLP/liveperson-api-python-wrapper.git

sudo python3 -m pip install awswrangler

sudo python3 -m pip install matplotlib

sudo python3 -m pip install fastparquet

sudo python3 -m pip install fastavro

sudo python3 -m pip install prophet

sudo python3 -m pip install matplotlib

sudo python3 -m pip install xgboost

sudo python3 -m pip install scikit-learn

 

## Setting up the spark defaults configuration

sudo sed -i '/spark.dynamicAllocation.enabled*/d' /usr/lib/spark/conf/spark-defaults.conf

sudo bash -c 'echo "spark.dynamicAllocation.enabled  false" >>  /usr/lib/spark/conf/spark-defaults.conf'

sudo sed -i '/spark.executor.instances.*/d' /usr/lib/spark/conf/spark-defaults.conf

sudo bash -c 'echo "spark.executor.instances 6" >>  /usr/lib/spark/conf/spark-defaults.conf'

sudo sed -i '/spark.executor.memory.*/d' /usr/lib/spark/conf/spark-defaults.conf

sudo bash -c 'echo "spark.executor.memory 3048M" >> /usr/lib/spark/conf/spark-defaults.conf'

sudo sed -i '/spark.executor.cores.*/d'  /usr/lib/spark/conf/spark-defaults.conf

sudo bash -c 'echo "spark.executor.cores 4" >>  /usr/lib/spark/conf/spark-defaults.conf'

sudo sed -i '/spark.driver.memory.*/d' /usr/lib/spark/conf/spark-defaults.conf

sudo bash -c 'echo "spark.driver.memory 1048M" >> /usr/lib/spark/conf/spark-defaults.conf'

sudo sed -i '/spark.driver.cores.*/d' /usr/lib/spark/conf/spark-defaults.conf

sudo bash -c 'echo "spark.driver.cores 2" >> /usr/lib/spark/conf/spark-defaults.conf'

sudo su

cd /usr/local/share/applications/edm-platform/batch

function batch-logs(){ tail -n 50000 -f /usr/local/share/applications/edm-platform/batch/$1/logs/$1-spark.log | grep -iE 'DEBUG|ERROR|Delta|postgre|processedRecs|joined|Exception|error|schema|credientialProperty' ; }

###from root

chmod -R 755 /usr/local/share/applications/

chmod -R 755 /mnt

 

·         Make sure our Spark version is 2.4.7-amzn-0 and Scala version is 2.11.12 because our scala code is compiled with only this version.

·         If the master is changed In Airflow connections update the connections EDM_DS_EMR and EDM_EMR with latest Master ip address.



 

Once all the above commands are executed release the job in Airflow

title: Prod Pentaho Server tracking
Planned down time:

Server

Start time

end time

Duration

Comments

prd-pentaho-01

02-26-2026 03:24:49 AM

02/26/2026 03:35:47 AM

10m 58s

CMB-465 To implement GC logging in carte servers Pentaho

prd-tary-01

02/26/2026 03:27:30 AM

02/26/2026 03:29:30 AM

2m

CMB-465 To implement GC logging in carte servers Pentaho

prd-carte-01

02/26/2026 03:27:30 AM

02/26/2026 03:29:30 AM

2m

CMB-465 To implement GC logging in carte servers Pentaho

prd-carte-02

02/26/2026 03:27:30 AM

02/26/2026 03:29:30 AM

2m

CMB-465 To implement GC logging in carte servers Pentaho

prd-carte-03

02/26/2026 03:27:30 AM

02/26/2026 03:29:30 AM

8m

CMB-465 To implement GC logging in carte servers Pentaho

prd-pentaho-01

06-03-2026 03:25

06-03-2026 03:56

30m 54s

CMB-472 OS Patch

prd-tray-01

06-03-2026 03:23

06-03-2026 03:53

30m 13s

CMB-472 OS Patch

prd-carte-01

06-03-2026 03:19

06-03-2026 03:52

32m 59s

CMB-472 OS Patch

prd-carte-02

06-03-2026 03:21

06-03-2026 03:50

29m

CMB-472 OS Patch

prd-carte-03

06-03-2026 03:22

06-03-2026 03:49

27m 1s

CMB-472 OS Patch

prd-pentaho-01

26-03-2026 12:04

26-03-2026 12:14

10m 7s

license update

prd-carte-01

26-03-2026 12:05

26-03-2026 12:07

2m

license update

prd-carte-02

26-03-2026 12:07

26-03-2026 12:11

4m

license update

prd-carte-03

26-03-2026 12:14

26-03-2026 12:16

1m 47s

license update

prd-pentaho-01







CMB-544 OS path

prd-tray-01







CMB-544 OS path and license for tray 

prd-carte-01







CMB-544 OS path

prd-carte-02







CMB-544 OS path

prd-carte-03







CMB-544 OS path



Other Downtimes:

Server

Start time

End time

Duration

Comments

prd-carte-02

01-01-2026  12:45:07

01-01-2026  12:48:06

2m 59s

server restart as it got disconnected with tray 
Analysis in DATA-13423 

prd-carte-03

05-01-2026 21:24:07

05-01-2026 21:27:07

3m

server restart as it got disconnected with tray 
Analysis in DATA-13423 

prd-carte-02

14-02-2026  05:24:06

14-02-2026  05:27:06

3m

server restart as it got disconnected with tray 
Analysis in DATA-13423 

prd-carte-01

15-03-2026  13:16:05

15-03-2026  13:18:05

2m

server restart as it got disconnected with tray 
Analysis in DATA-13423 

prd-carte-02

06-04-2026 02:43:06

06-04-2026 02:45:07

2m

server restart as it got disconnected with tray 
Analysis in DATA-13423 

prd-carte-03

12-04-2026 01:53:07

12-04-2026 01:55:07

2m

server restart as it got disconnected with tray 
Analysis in DATA-13423 

