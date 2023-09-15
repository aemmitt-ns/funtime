# funtime

`funtime` is an Objective-C runtime tracing tool made with frida

## Usage 

```
$ funtime -h
usage: funtime [-h] [-s] [-U] [-b] -n NAME [-t THEME] [-c BGCOLOR] [-l SCRIPT] SEL [SEL ...]

funtime: Objective-C runtime tracing

positional arguments:
  SEL                   a method selector like "*[NSMutable* initWith*]"

optional arguments:
  -h, --help            show this help message and exit
  -s, --spawn           spawn process
  -U, --usb             use usb device
  -b, --backtrace       display backtrace (slow)
  -n NAME, --name NAME  name of process or pid
  -t THEME, --theme THEME
                        display theme
  -c BGCOLOR, --bgcolor BGCOLOR
                        background color
  -l SCRIPT, --script SCRIPT
                        load an additional script
```

## Example

```
$ funtime -n Notes -b -t one-dark '+[NSPredicate *]'

    +[NSPredicate
        predicateWithFormat: (__NSCFConstantString *)( @"(ocrSummaryVersion < %d)" )];
    return (NSComparisonPredicate *)( /* ocrSummaryVersion < 1 */ 0x600000538810 );
    /* backtrace:
        0x1ca93ebc8 : -[ICAttachmentPreviewGenerator missingOrOutdatedOCRSummaryAttachmentIDsInContext:]
        0x1ca93ee7c : -[ICAttachmentPreviewGenerator missingOrOutdatedMetaDataAttachmentIDsInContext:]
        0x1ca861fe8 : -[ICAttachmentPreviewGenerator generateMissingOrOutdatedAttachmentMetaDataIfNeededInContext:]
        0x104c6d560 : 0x9d560 (0x10009d560)
        0x186bde874 : _dispatch_call_block_and_release
        0x186be0400 : _dispatch_client_callout
        0x186bf1fb8 : _dispatch_root_queue_drain
        0x186bf26c0 : _dispatch_worker_thread2
        0x186d8c038 : _pthread_wqthread
    */ // time: 2023-09-15T11:21:37.283287

    +[NSCompoundPredicate
        orPredicateWithSubpredicates: (__NSArrayI *)( /* (
            "ocrSummary == nil",
            "ocrSummaryVersion < 1"
        ) */ 0x6000012684e0 )];
    return (NSCompoundPredicate *)( /* ocrSummary == nil OR ocrSummaryVersion < 1 */ 0x600001268560 );
    /* backtrace:
        0x1ca93ec0c : -[ICAttachmentPreviewGenerator missingOrOutdatedOCRSummaryAttachmentIDsInContext:]
        0x1ca93ee7c : -[ICAttachmentPreviewGenerator missingOrOutdatedMetaDataAttachmentIDsInContext:]
        0x1ca861fe8 : -[ICAttachmentPreviewGenerator generateMissingOrOutdatedAttachmentMetaDataIfNeededInContext:]
        0x104c6d560 : 0x9d560 (0x10009d560)
        0x186bde874 : _dispatch_call_block_and_release
        0x186be0400 : _dispatch_client_callout
        0x186bf1fb8 : _dispatch_root_queue_drain
        0x186bf26c0 : _dispatch_worker_thread2
        0x186d8c038 : _pthread_wqthread
    */ // time: 2023-09-15T11:21:37.334973      
```