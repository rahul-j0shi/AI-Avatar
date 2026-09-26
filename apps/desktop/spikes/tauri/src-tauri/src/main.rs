#[cfg(target_os = "linux")]
use gtk::prelude::{Cast, WidgetExt};
#[cfg(target_os = "linux")]
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct InputRegion {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

#[tauri::command]
fn start_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    println!("SVARA_SPIKE_EVENT {{\"name\":\"drag-start\",\"details\":{{}}}}");
    window.start_dragging().map_err(|error| error.to_string())
}

#[tauri::command]
fn record_event(name: String, details: serde_json::Value) {
    println!(
        "SVARA_SPIKE_EVENT {}",
        serde_json::json!({ "name": name, "details": details })
    );
}

#[tauri::command]
fn set_input_regions(
    window: tauri::WebviewWindow,
    regions: Vec<InputRegion>,
) -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        let region_count = regions.len();
        let outcome = Arc::new(Mutex::new(None));
        let callback_outcome = Arc::clone(&outcome);
        window
            .with_webview(move |webview| {
                let result = (|| {
                    let top_level = webview
                        .inner()
                        .toplevel()
                        .and_then(|widget| widget.downcast::<gtk::Window>().ok())
                        .ok_or_else(|| "WebKitGTK top-level window is unavailable".to_owned())?;
                    let gdk_window = top_level
                        .window()
                        .ok_or_else(|| "GTK window has not been realized".to_owned())?;
                    let input_region = cairo::Region::create();

                    for rectangle in regions {
                        if rectangle.width <= 0 || rectangle.height <= 0 {
                            continue;
                        }
                        input_region
                            .union_rectangle(&cairo::RectangleInt::new(
                                rectangle.x,
                                rectangle.y,
                                rectangle.width,
                                rectangle.height,
                            ))
                            .map_err(|error| error.to_string())?;
                    }

                    gdk_window.input_shape_combine_region(&input_region, 0, 0);
                    Ok::<(), String>(())
                })();

                if let Ok(mut guard) = callback_outcome.lock() {
                    *guard = Some(result);
                }
            })
            .map_err(|error| error.to_string())?;

        outcome
            .lock()
            .map_err(|_| "Input-shape result lock was poisoned".to_owned())?
            .take()
            .ok_or_else(|| "WebKitGTK input-shape callback did not run".to_owned())??;

        Ok(format!("native input shape · {region_count} regions"))
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (window, regions);
        Err("The input-shape spike only supports Linux".to_owned())
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window
                    .set_always_on_top(true)
                    .map_err(|error| Box::<dyn std::error::Error>::from(error.to_string()))?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            record_event,
            set_input_regions,
            start_drag
        ])
        .run(tauri::generate_context!())
        .expect("failed to run the Svara Tauri spike");
}
