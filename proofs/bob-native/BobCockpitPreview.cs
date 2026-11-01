// File: BobCockpitPreview.cs
// Purpose: Temporary WinForms/WebView2 proof host. NOT a production Tauri build.
using System;
using System.IO;
using System.Linq;
using System.Drawing;
using System.Collections;
using System.Collections.Generic;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal static class BobCockpitPreview {
  [STAThread]
  static void Main(string[] args) {
    if (args.Length < 1 || !args[0].StartsWith("http://127.0.0.1:", StringComparison.Ordinal)) {
      MessageBox.Show("Run this preview through the isolated Node launcher.", "Mr. Mak Bob Preview");
      return;
    }
    Application.EnableVisualStyles();
    Application.SetCompatibleTextRenderingDefault(false);
    Application.Run(new PreviewForm(args[0]));
  }
}
internal sealed class PreviewForm : Form {
  private readonly WebView2 ui;
  private readonly JavaScriptSerializer serializer = new JavaScriptSerializer();
  private readonly Dictionary<string,WebView2> bobViews = new Dictionary<string,WebView2>();
  private readonly string uiUrl, uiOrigin, folder;
  private CoreWebView2Environment bobEnvironment;
  private string selected = null;
  private Rectangle browserArea;
  private bool ready;
  public PreviewForm(string url) {
    uiUrl=url;
    var uri=new Uri(url);
    uiOrigin=uri.GetLeftPart(UriPartial.Authority);
    folder=Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "state");
    Directory.CreateDirectory(folder);
    Text="Mr. Mak — Chats / Bob Native Integration Preview (isolated)";
    Width=1150;Height=850;MinimumSize=new Size(710,560);
    StartPosition=FormStartPosition.CenterScreen;
    ui=new WebView2 { Dock=DockStyle.Fill, DefaultBackgroundColor=Color.FromArgb(19,20,25) };
    Controls.Add(ui);
    Shown+= async (s,e) => await Initialize();
    FormClosed+= (s,e) => { foreach(var v in bobViews.Values) v.Dispose(); };
  }
  private void Log(string line) {
    try { File.AppendAllText(Path.Combine(folder, "preview.log"), DateTime.Now.ToString("o")+" "+line+Environment.NewLine); } catch {}
  }
  private async Task Initialize() {
    try {
      var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(folder,"MrMak-UI-Profile"),null);
      bobEnvironment=await CoreWebView2Environment.CreateAsync(null,Path.Combine(folder,"Bob-ChatGPT-Profile"),null);
      await ui.EnsureCoreWebView2Async(env);
      ui.CoreWebView2.WebMessageReceived+=HandleUiMessage;
      ui.CoreWebView2.NavigationCompleted+=async (sender,args) => {
        Log("UI_NAVIGATION_DONE success="+args.IsSuccess);
        for(int attempt=0;attempt<8;attempt++) {
          await Task.Delay(500);
          string count=await ui.ExecuteScriptAsync("document.querySelectorAll('.bob-tab .chat-tab-select').length");
          if(count!="0") {
            Log("BOB_TABS_RENDERED="+count);
            var clicked=await ui.ExecuteScriptAsync("(function(){var b=document.querySelector('.bob-tab .chat-tab-select');if(b){b.click();return true;}return false;})()");
            Log("AUTO_SELECTED_FIRST_BOB="+clicked);
            break;
          }
        }
      };
      ui.CoreWebView2.Navigate(uiUrl);
      ready=true;
      Log("UI_READY");
    } catch(Exception ex) { Log("UI_ERROR "+ex.GetType().Name+" "+ex.Message);MessageBox.Show(ex.Message,"Preview failed"); }
  }
  private static string Field(IDictionary<string,object> obj, string name) {
    object value;
    return obj.TryGetValue(name,out value) ? value as string : null;
  }
  private void HandleUiMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e) {
    if (!ready || e.Source==null || !e.Source.StartsWith(uiOrigin+"/",StringComparison.OrdinalIgnoreCase)) return;
    try {
      var message=serializer.Deserialize<Dictionary<string,object>>(e.WebMessageAsJson);
      var type=Field(message,"type");
      if (type=="bob-hide") { HideBob(); return; }
      if (type=="bob-close") { CloseBob(Field(message,"id")); return; }
      if (type!="bob-select") return;
      var id=Field(message,"id");
      if (String.IsNullOrWhiteSpace(id) || id.Length>64) return;
      var candidates=message.ContainsKey("tabs") ? message["tabs"] as IEnumerable : null;
      if(candidates==null)return;
      string url=null;
      foreach(var item in candidates) {
        var data=item as Dictionary<string,object>;
        if(data!=null && Field(data,"id")==id)url=Field(data,"url");
      }
      if(!AllowedConversation(url))return;
      var rect=message.ContainsKey("rect") ? message["rect"] as Dictionary<string,object> : null;
      if(rect==null)return;
      browserArea=new Rectangle(Convert.ToInt32(rect["x"]), Convert.ToInt32(rect["y"]),
        Math.Max(0,Convert.ToInt32(rect["width"])), Math.Max(0,Convert.ToInt32(rect["height"])));
      var bounds=ClientRectangle;
      browserArea=Rectangle.Intersect(browserArea,bounds);
      selected=id;
      var ignore=ShowBob(id,url);
    } catch(Exception ex) { Log("UI_MESSAGE_ERROR "+ex.GetType().Name+" "+ex.Message); }
  }
  private bool AllowedConversation(string url) {
    Uri parsed;
    if(!Uri.TryCreate(url,UriKind.Absolute,out parsed))return false;
    return parsed.Scheme=="https" && parsed.Host=="chatgpt.com" && parsed.Port==443 &&
      String.IsNullOrEmpty(parsed.UserInfo) && String.IsNullOrEmpty(parsed.Query) && String.IsNullOrEmpty(parsed.Fragment) &&
      (parsed.AbsolutePath=="/" || System.Text.RegularExpressions.Regex.IsMatch(parsed.AbsolutePath,
       @"^/c/[A-Za-z0-9_-]{8,100}$|^/g/[A-Za-z0-9_-]{8,100}/c/[A-Za-z0-9_-]{8,100}$"));
  }
  private async Task ShowBob(string id,string url) {
    foreach(var pair in bobViews)if(pair.Key!=id)pair.Value.Visible=false;
    WebView2 browser;
    if(!bobViews.TryGetValue(id,out browser)) {
      browser=new WebView2 { Visible=false, DefaultBackgroundColor=Color.White };
      bobViews.Add(id,browser);
      Controls.Add(browser);
      try {
        await browser.EnsureCoreWebView2Async(bobEnvironment);
        // The remote site receives NO host messages, objects, or privileged local API.
        browser.CoreWebView2.Settings.IsWebMessageEnabled=false;
        browser.CoreWebView2.Settings.AreHostObjectsAllowed=false;
        browser.CoreWebView2.SourceChanged+=(s,e)=> {
          if(browser.CoreWebView2==null)return;
          string visited=browser.CoreWebView2.Source;
          if(AllowedConversation(visited)) {
            var js="window.dispatchEvent(new CustomEvent('bob-webview-url',{detail:{id:"+serializer.Serialize(id)+",url:"+serializer.Serialize(visited)+"}}))";
            ui.CoreWebView2.ExecuteScriptAsync(js);
          }
        };
        browser.CoreWebView2.Navigate(url);
        Log("BOB_VIEW_CREATED");
      } catch(Exception ex) { Log("BOB_CREATE_ERROR "+ex.GetType().Name+" "+ex.Message);return; }
    }
    if(selected!=id)return;
    browser.Bounds=browserArea;
    browser.Visible=true;
    browser.BringToFront();
  }
  private void HideBob() {
    selected=null;
    foreach(var view in bobViews.Values)view.Visible=false;
    ui.BringToFront();
  }
  private void CloseBob(string id) {
    if(String.IsNullOrEmpty(id))return;
    WebView2 view;
    if(!bobViews.TryGetValue(id,out view))return;
    if(selected==id)HideBob();
    bobViews.Remove(id);
    Controls.Remove(view);
    view.Dispose();
  }
}
