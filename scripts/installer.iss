; 🌌 VST GOD - The God Realm Inno Setup Script
; Generates a professional Windows installer packaging VST3, Standalone, and Sample Library.

[Setup]
AppId={{E1D3B84A-5B4A-4C48-B33A-0ACADB6EE7C7}}
AppName=VST God - The God Realm
AppVersion=1.0.0
AppPublisher=MixxTech
AppPublisherURL=https://mixxtech.city
DefaultDirName={autopf}\MixxTech\VST God
DefaultGroupName=MixxTech\VST God
OutputDir=..\build
OutputBaseFilename=VST_God_The_God_Realm_Installer
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
DisableWelcomePage=no
DisableDirPage=no
DisableProgramGroupPage=yes
SetupIconFile=..\public\favicon.ico
WizardStyle=modern

[Types]
Name: "full"; Description: "Full installation (Standalone, VST3, and Samples)"
Name: "custom"; Description: "Custom installation"; Flags: iscustom

[Components]
Name: "standalone"; Description: "Standalone Application (.exe)"; Types: full custom; Flags: fixed
Name: "vst3"; Description: "VST3 Plugin (.vst3)"; Types: full custom
Name: "samples"; Description: "Factory Sample Library (~365MB)"; Types: full custom

[Files]
; Standalone Application
Source: "..\build\VSTGodTheGodRealm_artefacts\Release\Standalone\VST God - The God Realm.exe"; DestDir: "{app}"; Components: standalone; Flags: ignoreversion

; VST3 Plugin File
Source: "..\build\VSTGodTheGodRealm_artefacts\Release\VST3\VST God - The God Realm.vst3"; DestDir: "{cf64}\VST3"; Components: vst3; Flags: ignoreversion recursesubdirs

; Factory Sample Library
Source: "..\public\kits\*"; DestDir: "{code:GetSampleDir}"; Components: samples; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\VST God - The God Realm"; Filename: "{app}\VST God - The God Realm.exe"; Components: standalone
Name: "{commondesktop}\VST God - The God Realm"; Filename: "{app}\VST God - The God Realm.exe"; Components: standalone; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Run]
Filename: "{app}\VST God - The God Realm.exe"; Description: "{cm:LaunchProgram,VST God - The God Realm}"; Flags: nowait postinstall skipifsilent; Components: standalone

[Code]
var
  SampleDirPage: TInputDirWizardPage;

procedure InitializeWizard;
begin
  // Create custom page for selecting the sample library folder
  SampleDirPage := CreateInputDirPage(wpSelectComponents,
    'Select Sample Library Directory', 
    'Where should the factory sample library be installed?',
    'Select the folder where the VST GOD sample library will be installed (~365MB).',
    False, 'New Folder');
  SampleDirPage.Add('');
  SampleDirPage.Values[0] := ExpandConstant('{commonappdata}\MixxTech\VST God\Samples');
end;

function GetSampleDir(Param: String): String;
begin
  Result := SampleDirPage.Values[0];
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
end;
